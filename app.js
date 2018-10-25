"use strict";

const puppeteer = require("puppeteer");
const devices = require("puppeteer/DeviceDescriptors");
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

app.post("/", async (req, res) => {
  const body = req.body;

  let args = ["--no-sandbox"];
  if (body.lang) {
    args.push("--lang=" + body.lang.join(","));
  }

  const browser = await puppeteer.launch({ args: args });
  const page = await browser.newPage();

  if (body.emulate) {
    await page.emulate(devices[body.emulate]);
  }

  const viewport = buildViewport(body.viewport);
  page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor
  });

  await preScrape(page, body.login);

  await page.goto(body.url, { waitUntil: "networkidle2" });

  if (typeof body.imageNumber == "number") {
    const image = await getImage(page, body.selector, body.imageNumber);
    res.type("image/png").send(image);
    browser.close();
  } else {
    const result = await getText(page, body.selector);
    res.send(result);
    browser.close();
  }
});

const server = app.listen(process.env.PORT || 8080, err => {
  if (err) return console.error(err);
  const port = server.address().port;
  console.info(`App listening on port ${port}`);
});

const buildViewport = viewport => {
  const _viewport = {
    width: 1200,
    height: 600,
    deviceScaleFactor: 1
  };
  if (viewport) {
    if (viewport.width) _viewport.width = viewport.width;
    if (viewport.height) _viewport.height = viewport.height;
    if (viewport.deviceScaleFactor)
      _viewport.deviceScaleFactor = viewport.deviceScaleFactor;
  }
  return _viewport;
};

const preScrape = async (page, login) => {
  if (login) {
    if (login.url) await page.goto(login.url, { waitUntil: "networkidle2" });
    if (login.id) {
      await page.focus(login.id.selector);
      await page.type(login.id.selector, login.id.value);
    }
    if (login.password) {
      await page.focus(login.password.selector);
      await page.type(login.password.selector, login.password.value);
    }
    if (login.submit) {
      const submit = await page.$(login.submit.selector);
      await submit.click();
    }
  }
};

const getText = async (page, selector) => {
  return await page.evaluate(_selector => {
    const result = Array.from(document.querySelectorAll(_selector));
    return result.map(data => data.textContent);
  }, selector);
};

const getImage = async (page, selector, imageNumber) => {
  const rects = await page.evaluate(async _selector => {
    const elements = Array.from(document.querySelectorAll(_selector));
    return elements.map(element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return {
        left: x,
        top: y,
        width: width,
        height: height,
        id: element.id
      };
    });
  }, selector);

  const rect = rects[imageNumber];

  const padding = 16;
  const buffer = await page.screenshot({
    clip: {
      x: rect.left - padding,
      y: rect.top - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    }
  });
  return buffer;
};
