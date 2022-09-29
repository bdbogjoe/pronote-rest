#!flask/bin/python
import datetime
import json
import logging.config
import threading
import time

import schedule

logging.config.fileConfig('logging.conf')

import os
import pronotepy
from flask import Flask, abort, render_template
from pronotepy import ent

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('home.html', children=children.keys())


@app.route('/lessons')
@app.route('/lessons/<child>')
def lessons(child=None):
    out = {}
    start = datetime.date.today()
    end = start + datetime.timedelta(days=config['lessons']['days'])
    for key in children:
        if child is None or child in key:
            client = children[key]
            if client.logged_in:
                out[key] = __serialize(sorted(client.lessons(start, end), key=get_date))
            else:
                abort(500)
    return out


@app.route('/information_and_surveys')
@app.route('/information_and_surveys/<child>')
@app.route('/information_and_surveys-<type>')
@app.route('/information_and_surveys-<type>/<child>')
def information_and_surveys(type=None, child=None):
    out = {}
    start = datetime.datetime.now() - datetime.timedelta(days=config['information_and_surveys']['days'])
    end = start + datetime.timedelta(days=config['information_and_surveys']['days'])
    only_unread = False
    if type is not None:
        if type == 'unread':
            only_unread = True
        else:
            abort(404)

    for key in children:
        if child is None or child in key:
            client = children[key]
            if client.logged_in:
                out[key] = __serialize(sorted(client.information_and_surveys(start, end, only_unread), key=get_date))
            else:
                abort(500)
    return out


@app.route('/discussions')
@app.route('/discussions/<child>')
def discussions(child=None):
    out = {}
    for key in children:
        if child is None or child in key:
            client = children[key]
            if client.logged_in:
                out[key] = __serialize(client.discussions())
            else:
                abort(500)
    return out


@app.route('/homework')
@app.route('/homework/<child>')
@app.route('/homework-<type>')
@app.route('/homework-<type>/<child>')
def homework(type=None, child=None):
    out = {}
    start = datetime.date.today()
    todo = False
    if type is not None and type == 'todo':
        todo = True
        start = start + datetime.timedelta(days=1)
        end = start
    else:
        end = start + datetime.timedelta(days=config['homework']['days'])

    for key in children:
        client = children[key]
        if child is None or child in key:
            if client.logged_in:
                work = sorted(client.homework(start, end), key=get_date)
                if todo:
                    work = filter(lambda w: not w.done, work)
                out[key] = __serialize(work)
            else:
                abort(500)
    return out


@app.route('/period/<child>')
@app.route('/period')
def period(child=None):
    out = {}
    for key in children:
        if child is None or child in key:
            client = children[key]
            if client.logged_in:
                out[key] = __serialize(client.current_period)
                out[key]['overall_average'] = __serialize(client.current_period.overall_average)
            else:
                abort(500)
    return out


def get_date(data):
    if hasattr(data, 'date'):
        data = getattr(data, 'date')
    if hasattr(data, 'start'):
        data = getattr(data, 'start')
    if hasattr(data, 'creation_date'):
        data = getattr(data, 'creation_date')

    return data


@app.route('/<type>/<child>')
@app.route('/<type>')
def current_period(type, child=None):
    out = {}
    for key in children:
        if child is None or child in key:
            client = children[key]
            if client.logged_in:
                if hasattr(client.current_period, type):
                    out[key] = __serialize(getattr(client.current_period, type))
                else:
                    abort(404)
            else:
                abort(500)
    return out


def __serialize(data):
    if hasattr(data, '__slots__'):
        out = {}
        for attr in data.__slots__:
            if hasattr(data, attr):
                if attr != '_client' and attr != '_content' and attr != '_files' and attr != '_raw_content':
                    out[attr] = __serialize(getattr(data, attr))
        return out
    else:
        if isinstance(data, str):
            return data
        else:
            try:
                out = []
                for item in iter(data):
                    out.append(__serialize(item))
                return out
            except TypeError as te:
                if isinstance(data, datetime.datetime) or isinstance(data, datetime.date):
                    return data.isoformat()
                elif isinstance(data, datetime.timedelta):
                    return data.total_seconds()
                else:
                    return data


def __createClient(_url, _account, _child, _ent):
    out = pronotepy.ParentClient(_url,
                                 username=_account['username'],
                                 password=_account['password'],
                                 ent=_ent)
    if _child is not None and _child != '':
        out.set_child(_child)
    return out


def __refresh():
    for key in children:
        logging.debug("Keep alive for " + key)
        if not children[key].session_check():
            logging.warning("Session is expired for " + key)
            __init()
            break


def __setupRefresh():
    __refresh()
    schedule.every(5).minutes.do(__refresh)
    while True:
        schedule.run_pending()
        time.sleep(1)


def __init():
    for account in config['accounts']:
        _ent = ''
        tmp = account.copy()
        tmp['password'] = 'xxxxx'
        logging.info("Processing account : " + json.dumps(tmp))
        if 'cas' in account:
            cas = account['cas']
            if cas is not None:
                _ent = getattr(ent, cas)
        mode = 'eleve'
        if 'parent' in account:
            if account['parent']:
                mode = 'parent'

        url = 'https://' + account['prefix'] + '.index-education.net/pronote/' + mode + '.html'
        logging.info("Using url to connect : " + url)

        if mode == 'parent':
            if 'child' in account and account['child'] != '':
                child = account['child']
            else:
                child = ''

            __client = __createClient(url, account, child, _ent)
            children[__client.children[0].name] = __client
            client = __client
            if len(__client.children) > 1:
                for child in __client.children:
                    if child.name != __client.children[0].name:
                        # Need to create new client
                        children[child.name] = __createClient(url, account, child.name, _ent)
        else:
            __client = pronotepy.Client(url,
                                        username=account['username'],
                                        password=account['password'],
                                        ent=_ent)
            children[__client.info.name] = __client


if __name__ == '__main__':
    defaultConfig = {
        'lessons': {'days': 7},
        'homework': {'days': 7},
        "information_and_surveys": {'days': 7},
    }
    with open('config/config.json') as f:
        config = json.load(f)

    config = defaultConfig | config
    debug = os.getenv('DEBUG') == 'true'
    port = os.getenv('PORT')

    children = {}

    __init()

    processThread = threading.Thread(target=__setupRefresh)
    processThread.start()
    app.run(host='0.0.0.0', port=port, debug=debug)
