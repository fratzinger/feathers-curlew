---
layout: home

hero:
  name: feathers-curlew
  text: Drive your FeathersJS server from the CLI
  tagline: An AI-friendly command-line toolkit you configure into your app. JSON in, JSON out.
  image:
    src: /logo.svg
    alt: feathers-curlew
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Custom Commands
      link: /guide/custom-commands

features:
  - title: In-process or remote
    details: Boot your app for full database access, or talk to a running server over REST / Socket.IO.
  - title: Auto-generated commands
    details: Every service becomes `curlew <service> find|get|create|update|patch|remove`, plus `authenticate`.
  - title: Built for agents
    details: JSON output by default, structured errors, and non-zero exit codes an AI can act on.
  - title: Custom commands
    details: Register your own commands (like `sql`) with direct access to the app instance.
---
