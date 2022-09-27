#!flask/bin/python
import datetime
import json
import os

import pronotepy
from flask import Flask
from pronotepy import ent

app = Flask(__name__)


@app.route('/')
def index():
    return "Welcome to pronote for : " + child


@app.route('/lessons')
def lessons():
    if client.logged_in:
        out = []
        start = datetime.date.today()
        end = start + datetime.timedelta(days=config['lessons']['days'])
        for les in client.lessons(start, end):

            content = None
            if les.content is not None:
                content = les.content.title

            json = {
                'id': les.id,
                'subject': les.subject.name,
                'teacher': les.teacher_name,
                'normal': les.normal,
                'content': content,
                'date': les.start.date().isoformat(),
                'start': les.start.strftime('%H:%M'),
                'end': les.end.strftime('%H:%M'),
                'detention': les.detention,
                'exempted': les.exempted,
                'status': les.status,
                'canceled': les.canceled,
                'room': les.classroom
            }
            out.append(json)

        return out
    else:
        return 'no login'


if __name__ == '__main__':
    defaultConfig = {
        'lessons': {'days': 7},
        'parent': True
    }
    with open('config/config.json') as f:
        config = json.load(f)

    config = defaultConfig | config
    _ent = ''
    if 'cas' in config:
        cas = config['cas']
        if cas is not None:
            _ent = getattr(ent, cas)
    mode = 'eleve'
    if 'parent' in config:
        if config['parent']:
            mode = 'parent'

    url = 'https://' + config['prefix'] + '.index-education.net/pronote/' + mode + '.html'

    if mode == 'parent':
        client = pronotepy.ParentClient(url,
                                        username=config['username'],
                                        password=config['password'],
                                        ent=_ent)
        if 'child' in config:
            client.set_child(config['child'])
            child = config['child']
        else:
            child = client.children[0].name
    else:
        client = pronotepy.Client(url,
                                  username=config['username'],
                                  password=config['password'],
                                  ent=_ent)

    debug = os.getenv('DEBUG') == 'true'
    port = os.getenv('PORT')
    app.run(host='0.0.0.0', port=port, debug=debug)
