# syntax=docker/dockerfile:1
FROM python:3.10-slim-buster


RUN useradd  app
RUN mkdir -p /home/app
RUN chown -R app:app /home/app

USER app
WORKDIR /home/app

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

COPY app.py .
COPY logging.conf .

COPY templates templates

ENTRYPOINT [ "python" ]

CMD [ "app.py" ]

EXPOSE 5000