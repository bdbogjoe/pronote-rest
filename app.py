#!flask/bin/python
import datetime
import json
import logging.config
import os

import pronotepy
from dateutil import rrule
from flask import Flask, abort, render_template, jsonify, request
from pronotepy import ent, ENTLoginError

logging.config.fileConfig('logging.conf')

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('home.html', children=children.keys())


@app.route('/lessons')
@app.route('/lessons/<child>')
def lessons(child=None):
    out = {}
    _days = request.args.get('days', default=None, type=int)
    if _days is None:
        _days = config['lessons']['days']
    start = datetime.date.today()
    end = start + datetime.timedelta(days=_days)
    for key in children:
        if child is None or child in key:
            client = children[key]
            if client.logged_in:
                out[key] = __serialize(sorted(client.lessons(start, end), key=get_sort))
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
                out[key] = __serialize(sorted(client.information_and_surveys(start, end, only_unread), key=get_sort))
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


def _nextWorkingDay(_start):
    r = rrule.rrule(rrule.DAILY,
                    byweekday=[rrule.MO, rrule.TU, rrule.WE, rrule.TH, rrule.FR],
                    dtstart=_start)
    # Create a rruleset
    rs = rrule.rruleset()

    # Attach our rrule to it
    rs.rrule(r)

    return r[0].date()


@app.route('/homework')
@app.route('/homework/<child>')
@app.route('/homework-<type>')
@app.route('/homework-<type>/<child>')
def homework(type=None, child=None):
    out = {}
    start = datetime.date.today()
    todo = False
    _days = request.args.get('days', default=None, type=int)
    if type is not None and type == 'todo':
        todo = True
        start = _nextWorkingDay(start + datetime.timedelta(days=1))
        if _days is None:
            _days = 0
    else:
        if _days is None:
            _days = config['homework']['days']

    end = _nextWorkingDay(start + datetime.timedelta(days=_days))
    for key in children:
        client = children[key]
        if child is None or child in key:
            if client.logged_in:
                work = sorted(client.homework(start, end), key=get_sort)

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
            current_period = __currentPeriod(client)
            if client.logged_in:
                out[key] = __buildPeriod(current_period)
            else:
                abort(500)
    return out


def __periods(client):
    out = []
    prefix = getattr(client.current_period, 'name')[0:-2]
    for p in client.periods:
        n = getattr(p, 'name')
        if n.startswith(prefix):
            out.append(p)
    out = sorted(out, key=get_sort)
    return out


@app.route('/periods/<child>')
@app.route('/periods')
def periods(child=None):
    out = {}
    for key in children:
        if child is None or child in key:
            client = children[key]
            if client.logged_in:
                data = {}
                out[key] = data
                for p in __periods(client):
                    n = getattr(p, 'name')
                    data[n] = __buildPeriod(p)
            else:
                abort(500)
    return out


def __buildPeriod(period):
    out = __serialize(period)
    out['overall_average'] = period.overall_average
    return out


def __currentPeriod(client):
    out = client.current_period
    if (__isPeriodValid(out)):
        return out
    else:
        for p in __periods(client):
            n = getattr(p, 'name')
            if __isPeriodValid(p):
                return p
    return out


def __isPeriodValid(period):
    now = datetime.datetime.now()
    start = getattr(period, 'start')
    end = getattr(period, 'end')
    return start <= now and now <= end


def get_sort(data):
    if hasattr(data, 'date'):
        data = getattr(data, 'date')
    elif hasattr(data, 'start'):
        data = getattr(data, 'start')
    elif hasattr(data, 'creation_date'):
        data = getattr(data, 'creation_date')
    elif hasattr(data, 'from_date'):
        data = getattr(data, 'from_date')
    elif hasattr(data, 'name'):
        data = getattr(data, 'name')
    elif hasattr(data, 'subject'):
        data = getattr(data, 'subject')
        data = getattr(data, 'name')

    return data


@app.route('/<type>/<child>')
@app.route('/<type>')
def data_period(type, child=None):
    out = {}
    nb_period = request.args.get('period', default=None, type=int)
    for key in children:
        if child is None or child in key:
            client = children[key]
            if client.logged_in:
                data = None
                cpt = 1
                for p in __periods(client):
                    current = __currentPeriod(client).id
                    if nb_period is None or cpt == nb_period or nb_period == 0 and p.id == current:
                        if hasattr(p, type):
                            tmp = getattr(p, type)
                            if isinstance(tmp, list) and type != 'averages':
                                if data is None:
                                    data = tmp
                                else:
                                    data.extend(tmp)
                            else:
                                if data is None:
                                    data = {}
                                data[p.name] = __serialize(tmp)
                        else:
                            abort(404)
                    cpt = cpt + 1
                if isinstance(data, list):
                    data = sorted(data, key=get_sort, reverse=True)
                    data = __serialize(data)

                out[key] = data
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


@app.errorhandler(ENTLoginError)
def internal_error(error):
    logging.error("Handling login error...")
    __init()
    success = False
    response = {
        'success': success,
        'error': {
            'type': error.__class__.__name__,
            'message': error.args[0]
        }
    }
    return jsonify(response), 401


def internal_error(error):
    logging.error(error)
    message = [str(x) for x in error.args]
    status_code = 500
    success = False
    response = {
        'success': success,
        'error': {
            'type': error.__class__.__name__,
            'message': message
        }
    }
    return jsonify(response), status_code


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

    app.run(host='0.0.0.0', port=port, debug=debug)
