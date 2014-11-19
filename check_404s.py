#
# Find picdinner pairs that point to 404 URLs on SoundCloud
# and mark them inactive, so people don't get blank pages.
#
# The SoundCloud HTML5 API doesn't expose the 404 directly!
#

from __future__ import print_function, division, unicode_literals

import pymongo
import requests
import subprocess
import os
import pprint
import sys

MONGO_SITE = 'picdinner.com'
MONGO_DB_NAME = 'picdinner_com'
MONGO_PROJECT_DIR = '/Users/pcoles/projects/meteor/picdinner'

def get_mongo_url(password):
    os.chdir(MONGO_PROJECT_DIR)
    p = subprocess.Popen(
        ['meteor', 'mongo', '--url', MONGO_SITE],
        stdout=subprocess.PIPE, stdin=subprocess.PIPE, stderr=subprocess.PIPE
    )
    resp, err = p.communicate(password + '\n')
    if err:
        return None

    x = resp.split(os.linesep)[1]
    return x.strip()

def get_db(mongo_url):
    db_name = mongo_url.split('/')[-1] or MONGO_DB_NAME
    client = pymongo.MongoClient(mongo_url)
    return client[db_name]


def yes_no():
    while True:
        answer = raw_input('Update these? (Y|n)')
        if answer.lower() in ('y', ''):
            return True
        elif answer.lower() == 'n':
            return False


def main(password):
    mongo_url = get_mongo_url(password)
    print('mongo_url:', mongo_url)

    db = get_db(mongo_url)
    print('db:', db)

    pairs = db.pairs.find({
        'audio': {'$ne': 'song.mp3'},
        'inactive': {'$ne': True}
    })
    matches = []

    for pair in pairs:
        error = False
        try:
            r = requests.get(pair.get('audio'))
        except requests.exceptions.MissingSchema:
            error = True
        else:
            if r.status_code == 404:
                error = True

        if error:
            matches.append(pair)
            pprint.pprint(pair)
            print()
            sys.stdout.flush()

    if matches:
        if yes_no():
            ids = [m['_id'] for m in matches]
            db.pairs.update(
                {
                    '_id': {'$in': ids}
                },
                {
                    '$set': {
                        'inactive': True
                    }
                },
                multi=True,
                upsert=False,
            )
            print('Done!')
    else:
        print('Nothing to update!')



if __name__ == '__main__':
    import getpass
    print('Lookup soundcloud 404s from pairs in remote db')
    password = getpass.getpass()
    main(password)
