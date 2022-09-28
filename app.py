#!flask/bin/python
import datetime
import json
import os

import pronotepy
from flask import Flask, abort, render_template
from pronotepy import ent

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('home.html', children=children.keys())


@app.route('/lessons')
def lessons():
    out = {}
    start = datetime.date.today()
    end = start + datetime.timedelta(days=config['lessons']['days'])
    for key in children:
        client = children[key]
        if client.logged_in:
            out[key] = __serialize(client.lessons(start, end))
        else:
            abort(500)
    return out


@app.route('/discussions')
def discussions():
    out = {}
    for key in children:
        client = children[key]
        if client.logged_in:
            out[key] = __serialize(client.discussions())
        else:
            abort(500)
    return out


@app.route('/homework')
@app.route('/homework/<type>')
def homework(type=None):
    out = {}
    start = datetime.date.today()
    todo = False
    if type is not None and type == 'todo':
        todo = True
        start = start + datetime.timedelta(days=1)
        end = start + datetime.timedelta(days=1)
    else:
        end = start + datetime.timedelta(days=config['homework']['days'])

    for key in children:
        client = children[key]
        if client.logged_in:
            work = client.homework(start, end)
            if todo:
                work = filter(lambda w: not w.done, work)
            out[key] = __serialize(work)
        else:
            abort(500)
    return out


@app.route('/absences')
def absences():
    out = {}
    for key in children:
        client = children[key]
        if client.logged_in:
            out[key] = __serialize(client.current_period.absences)
        else:
            abort(500)
    return out


@app.route('/overall_average')
def overall_average():
    out = {}
    for key in children:
        client = children[key]
        if client.logged_in:
            out[key] = __serialize(client.current_period.overall_average)
        else:
            abort(500)
    return out


@app.route('/punishments')
def punishments():
    out = {}
    for key in children:
        client = children[key]
        if client.logged_in:
            out[key] = __serialize(client.current_period.punishments)
        else:
            abort(500)
    return out


@app.route('/grades')
def grades():
    out = {}
    for key in children:
        client = children[key]
        if client.logged_in:
            out[key] = __serialize(client.current_period.grades)
        else:
            abort(500)
    return out


@app.route('/averages')
def averages():
    out = {}
    for key in children:
        client = children[key]
        if client.logged_in:
            out[key] = __serialize(client.current_period.averages)
        else:
            abort(500)
    return out


@app.route('/evaluations')
def evaluations():
    out = {}
    for key in children:
        client = children[key]
        if client.logged_in:
            out[key] = __serialize(client.current_period.evaluations)
        else:
            abort(500)
    return out


@app.route('/<child>/period')
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


def __serialize(data):
    if hasattr(data, '__slots__'):
        out = {}
        for attr in data.__slots__:
            if hasattr(data, attr):
                if attr != '_client' and attr != '_content' and attr != '_files':
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


def __createClient(__child):
    out = pronotepy.ParentClient(url,
                                 username=account['username'],
                                 password=account['password'],
                                 ent=_ent)
    if __child is not None and __child != '':
        out.set_child(__child)
    return out


if __name__ == '__main__':
    defaultConfig = {
        'lessons': {'days': 7},
        'homework': {'days': 7}
    }
    with open('config/config.json') as f:
        config = json.load(f)

    config = defaultConfig | config
    children = {}

    for account in config['accounts']:
        _ent = ''
        if 'cas' in account:
            cas = account['cas']
            if cas is not None:
                _ent = getattr(ent, cas)
        mode = 'eleve'
        if 'parent' in account:
            if account['parent']:
                mode = 'parent'

        url = 'https://' + account['prefix'] + '.index-education.net/pronote/' + mode + '.html'

        if mode == 'parent':
            if 'child' in account and account['child'] != '':
                child = account['child']
            else:
                child = ''

            __client = __createClient(child)
            children[__client.children[0].name] = __client
            client = __client
            if len(__client.children) > 1:
                for child in __client.children:
                    if child.name != __client.children[0].name:
                        # Need to create new client
                        children[child.name] = __createClient(child.name)
        else:
            __client = pronotepy.Client(url,
                                        username=account['username'],
                                        password=account['password'],
                                        ent=_ent)
            children[__client.info.name] = __client
    debug = os.getenv('DEBUG') == 'true'
    port = os.getenv('PORT')
    app.run(host='0.0.0.0', port=port, debug=debug)
