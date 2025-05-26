# syntax=docker/dockerfile:1
FROM python:3.12-slim-bullseye

RUN apt-get update
RUN apt-get install -y wget gnupg curl jq unzip

# Install Google Chrome dependencies
RUN apt-get install -y libxss1 libappindicator1 libgconf-2-4 \
    fonts-liberation libasound2 libnspr4 libnss3 libx11-xcb1 libxtst6 lsb-release xdg-utils \
    libgbm1 libnss3 libatk-bridge2.0-0 libgtk-3-0 libx11-xcb1 libxcb-dri3-0


# Fetch the latest version numbers and URLs for Chrome and ChromeDriver
RUN curl -s https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json > /tmp/versions.json

RUN CHROME_URL=$(jq -r '.channels.Stable.downloads.chrome[] | select(.platform=="linux64") | .url' /tmp/versions.json) && \
    wget -q --continue -O /tmp/chrome-linux64.zip $CHROME_URL && \
    unzip /tmp/chrome-linux64.zip -d /opt/chrome

RUN chmod +x /opt/chrome/chrome-linux64/chrome


RUN CHROMEDRIVER_URL=$(jq -r '.channels.Stable.downloads.chromedriver[] | select(.platform=="linux64") | .url' /tmp/versions.json) && \
    wget -q --continue -O /tmp/chromedriver-linux64.zip $CHROMEDRIVER_URL && \
    unzip /tmp/chromedriver-linux64.zip -d /opt/chromedriver && \
    chmod +x /opt/chromedriver/chromedriver-linux64/chromedriver

# Set up Chromedriver Environment variables
ENV CHROMEDRIVER_DIR=/opt/chromedriver/chromedriver-linux64
ENV CHROME_DIR=/opt/chrome/chrome-linux64
ENV PATH=$CHROMEDRIVER_DIR:$CHROME_DIR:$PATH




RUN echo "Chrome: " && chrome --version


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