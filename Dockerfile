# syntax=docker/dockerfile:1
FROM python:3.13-slim-bullseye

RUN apt-get update

RUN apt-get install --no-install-recommends -y chromium chromium-driver gcc

RUN apt-get clean
RUN rm -rf /var/lib/apt/lists
RUN rm -rf /var/cache/apt/archives

RUN useradd  app
RUN mkdir -p /home/app/config
RUN mkdir -p /home/app/screenshot
RUN chown -R app:app /home/app

USER app
WORKDIR /home/app

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

COPY *.py ./
COPY logging.conf .

COPY templates templates
COPY static static

ENTRYPOINT [ "python" ]

CMD [ "app.py" ]

EXPOSE 5000