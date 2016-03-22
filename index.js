'use strict';

const inquirer = require('inquirer');
const Tumblr = require('tumblr.js');
const _ = require('underscore');
const path = require('path');
const request = require('request');
const async = require('async');
const settings = require('./settings.json');

const tumblr = Tumblr.createClient(settings.api.tumblr);

const questions = [
  {
    type: 'list',
    name: 'blog',
    message: 'Which blog to post to?',
    default: 'onesongmayhem',
    choices: function () {
      let done = this.async();

      tumblr.userInfo((err, data) => {
        if (err) {
          return done(err);
        }

        let things = _.map(data.user.blogs, blog => ({
          name: blog.url,
          value: blog.name,
          short: blog.name
        }));

        return done(things);
      });
    }
  },
  {
    type: 'list',
    name: 'preset',
    message: 'What to post?',
    choices: [
      'Spotify track',
      'Spotify album'
    ]
  },
  {
    type: 'input',
    name: 'audioPost',
    message: 'Spotify Track URL',
    filter: function (spotifyUrl) {
      let done = this.async();
      let trackId = path.basename(spotifyUrl);

      async.waterfall([
        next => request('https://api.spotify.com/v1/tracks/' + trackId, next),
        (response, body, next) => next(null, JSON.parse(body)),
        (track, next) => next(null, {
          type: 'audio',
          external_url: track.external_urls.spotify, // eslint-disable-line camelcase
          tags: ['music', ...track.artists.map(artist => artist.name.toLowerCase())],
          slug: [track.artists[0].name, track.name, ...track.artists.slice(1)].join('-').toLowerCase().replace(' ', '-')
        })
      ], (err, result) => {
        if (err) {
          console.error('Error!', err);
          return done(err);
        }
        return done(result);
      });
    },
    when: answers => answers.preset === 'Spotify track'
  },
  {
    type: 'input',
    name: 'audioPost',
    message: 'Spotify Album URL',
    filter: function (spotifyUrl) {
      let done = this.async();
      let trackId = path.basename(spotifyUrl);

      async.waterfall([
        next => request('https://api.spotify.com/v1/albums/' + trackId, next),
        (response, body, next) => next(null, JSON.parse(body)),
        (album, next) => next(null, {
          type: 'audio',
          external_url: album.external_urls.spotify, // eslint-disable-line camelcase
          tags: ['music', album.name, ...album.artists.map(artist => artist.name.toLowerCase())],
          slug: [album.artists[0].name, album.name, ...album.artists.slice(1)].join('-').toLowerCase().replace(' ', '-')
        })
      ], (err, result) => {
        if (err) {
          console.error('Error!', err);
          return done(err);
        }
        return done(result);
      });
    },
    when: answers => answers.preset === 'Spotify album'
  },
  {
    name: 'postCaption',
    message: 'Post caption? (empty for default)',
    default: function (answers) {
      if (answers.audioPost && answers.audioPost.caption) {
        return answers.audioPost;
      }
      return '';
    }
  }
];

inquirer.prompt(questions, answers => {
  let post = _.extend({
    blog: answers.blog,
    state: 'published',
    caption: ''
  }, answers.audioPost);

  if (answers.postCaption) {
    post.caption = answers.postCaption;
  }

  if (answers.blog === 'onesongmayhem') {
    post.tags = ['1 song mayhem', ...post.tags];
  }

  if (answers.blog === 'listhype') {
    post.tags = ['listhype', ...post.tags];
  }

  // Clean slug
  if (post.slug) {
    post.slug = post.slug.trim().replace(/(\s+)/, '-');
  }

  post.tags = post.tags.join(',');

  inquirer.prompt({
    type: 'confirm',
    name: 'confirmed',
    default: false,
    message: 'What do you think?\n\n' + JSON.stringify(post, null, 2)
  }, answer => {
    if (answer.confirmed) {
      if (post.type === 'audio') {
        console.log('posting...');
        tumblr.audio(post.blog, post, err => {
          if (err) {
            return console.error('Not posted..', err);
          }
          console.log('Posted successfully!');
        });
      }
    } else {
      console.log('Cancelled...');
    }
  });
});
