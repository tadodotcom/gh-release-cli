#!/usr/bin/env node

const fs = require('fs');
const minimist = require('minimist');
const GitHubApi = require('@octokit/rest');
const mime = require('mime-types');

const argv = minimist(process.argv.slice(2));

const owner = argv.owner;
const repo = argv.repo;
const tagName = argv.tag;
const targetCommitish = argv.commit;
const name = argv.name;
const bodyFile = argv.body;
const assets = argv.assets.split(',');

const github = new GitHubApi({
    version: '3.0.0',
    headers: {
        'user-agent': 'gh-release-cli'
    },
    timeout: 20000
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

const body = fs.readFileSync(bodyFile, 'utf8');

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
        const uploads = assets.map(file => {
                const headers = {
                    'content-length': fs.statSync(file).size,
                    'content-type': mime.lookup(file)
                };

                return github.repos.uploadReleaseAsset({
                    headers: headers,
                    url: release.upload_url,
                    name: file,
                    file: fs.createReadStream(file)
                });
            }
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
        console.log(`created GitHub release ${name}: ${release.html_url}`);
    })
    .catch(data => {
        console.error(`failed to create GitHub release: ${data.message}`);
        process.exit(1);
    });