# FLORA / FIELD

An interactive particle-art playground with hand-gesture controls, eight morphing shapes, and touch/mouse interaction.

## Live demo

After GitHub Pages deployment: https://ziyuhua25.github.io/flora-field/

## Controls

- Open palm: disperse particles; fist: gather particles.
- Pinch: move the sculpture; two hands: scale.
- Mouse or touch: rotate, zoom, and toggle dispersion.
- Switch between flower, Christmas tree, galaxy, heart, snowflake, Saturn, butterfly and DNA.

## Privacy and requirements

Camera access is optional. Gesture recognition runs in the browser using MediaPipe Hands loaded from jsDelivr. Camera access requires permission and a secure context (HTTPS or localhost). The application does not include a backend or upload camera frames. A network connection is needed for initial model loading. Mouse/touch control works without camera access.

## Deployment

Publish the repository as a public GitHub Pages site from `main` and `/ (root)`. On macOS, use `bash publish.sh` after installing and authenticating GitHub CLI (`brew install gh`, `gh auth login`).
