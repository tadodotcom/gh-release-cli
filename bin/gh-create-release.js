#!/usr/bin/env node

var minimist = require('minimist');
var GitHubApi = require('github');

var argv = minimist(process.argv.slice(2));

var owner = argv.owner;
var repo = argv.repo;
var tagName = argv.tag;
var targetCommitish = argv.commit;
var name = argv.name;
var body = argv.body;
var assets = argv.assets.split(',');

var github = new GitHubApi({
    version: '3.0.0',
    headers: {
        'user-agent': 'gh-release-cli'
    },
    timeout: 5000
});

var githubToken = process.env.GITHUB_TOKEN;
if (!!githubToken) {
    github.authenticate({
        type: "token",
        token: githubToken
    });
}

github.repos.createRelease({
    owner: owner,
    repo: repo,
    tag_name: tagName,
    target_commitish: targetCommitish,
    name: name,
    body: body,
    draft: false
}).then(function (resp) {
    return resp.data;
}).then(function (release) {
    var uploads = assets.map(function (file) {
        return github.repos.uploadAsset({
            owner: owner,
            repo: repo,
            id: release.id,
            filePath: file,
            name: file
        });
    });

    return Promise.all(uploads)
        .then(function () {
            return release;
        }).catch(function (data) {
            return github.repos.deleteRelease({
                owner: owner,
                repo: repo,
                id: release.id
            }).then(function () {
                throw new Error('failed uploading assets: ' + data);
            });
        });
}).then(function (release) {
    console.log('release ' + name + ' created: ' + release.html_url);
}).catch(function (data) {
    console.error(data.message);
    process.exit(1);
});