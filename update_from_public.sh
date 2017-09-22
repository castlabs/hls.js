#!/usr/bin/env bash
exists=`git remote -v | grep -c 'public'`
if [ "$exists" = "0" ]; then
    echo "remote public doesn't exists, adding";
    git remote add public git@github.com:video-dev/hls.js.git
fi
git checkout master
git pull public master
git fetch public master
git fetch public --tags
git push origin master
git push origin --tags
