#!/usr/bin/env node

const minimist = require('minimist');
const GitHubApi = require('github');

const argv = minimist(process.argv.slice(2));

const owner = argv.owner;
const repo = argv.repo;
const tagName = argv.tag;
const targetCommitish = argv.commit;
const name = argv.name;
const body = argv.body;
const assets = argv.assets.split(',');

const github = new GitHubApi({
    version: '3.0.0',
    headers: {
        'user-agent': 'gh-release-cli'
    },
    timeout: 5000
});

const githubToken = process.env.GITHUB_TOKEN;
if (!!githubToken) {
    github.authenticate({
        type: 'token',
        token: githubToken
    });
} else {
    console.warn('environment variable GITHUB_TOKEN not found => unauthenticated API access');
}

github.repos.createRelease({
    owner: owner,
    repo: repo,
    tag_name: tagName,
    target_commitish: targetCommitish,
    name: name,
    body: body,
    draft: false
})
    .then(resp => resp.data)
    .then(release => {
        const uploads = assets.map(file =>
            github.repos.uploadAsset({
                owner: owner,
                repo: repo,
                id: release.id,
                filePath: file,
                name: file
            })
        );

        return Promise.all(uploads)
            .then(() => release)
            .catch(data => {
                return github.repos.deleteRelease({
                    owner: owner,
                    repo: repo,
                    id: release.id
                }).then(() => {
                    throw new Error(`failed uploading assets: ${data}`);
                });
            });
    })
    .then(release => {
        console.log(`release ${name} created: ${release.html_url}`);
    })
    .catch(data => {
        console.error(data.message);
        process.exit(1);
    });