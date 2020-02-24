#!/usr/bin/env node

const fs = require('fs');
const minimist = require('minimist');
const {Octokit} = require('@octokit/rest');
const mime = require('mime-types');

const argv = minimist(process.argv.slice(2));

const owner = argv.owner;
const repo = argv.repo;
const tagName = argv.tag;
const targetCommitish = argv.commit;
const name = argv.name;
const bodyFile = argv.body;
const assets = argv.assets.split(',');

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
    console.warn('environment variable GITHUB_TOKEN not found => unauthenticated API access');
}

const github = new Octokit({
    auth: githubToken,
    userAgent: 'gh-release-cli',
    request: {
        version: '3.0.0',
        timeout: 20000
    }
});

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
                    owner: owner,
                    repo: repo,
                    release_id: release.id,
                    headers: headers,
                    url: release.upload_url,
                    name: file,
                    data: fs.createReadStream(file)
                });
            }
        );

        return Promise.all(uploads)
            .then(() => release)
            .catch(error => {
                return github.repos.deleteRelease({
                    owner: owner,
                    repo: repo,
                    release_id: release.id
                }).then(() => {
                    throw new Error(`failed uploading assets: ${error}`);
                }).catch(() => {
                    throw new Error(`failed deleting release: ${error}`);
                });
            });
    })
    .then(release => {
        console.log(`created GitHub release ${name}: ${release.html_url}`);
    })
    .catch(error => {
        console.error(`failed to create GitHub release: ${error}`);
        process.exit(1);
    });
