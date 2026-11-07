// Runs on 404.html: forwards short links that have no page of their own.
// GitHub Pages paths are case-sensitive, so they are matched case-insensitively here.

const REDIRECTS = {
  "/kalender": "https://calendar.google.com/calendar/embed?src=kio3k9eqnbkh15f3gh1laf804e4qug0b%40import.calendar.google.com&ctz=Europe%2FVienna",
};

const target = REDIRECTS[location.pathname.toLowerCase()];
if (target) location.replace(target);
