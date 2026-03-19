// Bundler-compatible shim for hterm resources.
// Replaces vendor/libapps/hterm/js/deps_resources.shim.js to fix
// JSON named import issues with webpack 5 + "type": "module".

import auBell from "../../vendor/libapps/hterm/audio/bell.ogg";
import htmlFindBar from "../../vendor/libapps/hterm/html/find_bar.html";
import htmlFindScreen from "../../vendor/libapps/hterm/html/find_screen.html";
import imgClose from "../../vendor/libapps/hterm/images/close.svg";
import imgCopy from "../../vendor/libapps/hterm/images/copy.svg";
import icon96 from "../../vendor/libapps/hterm/images/icon-96.png";
import imgKeyboardArrowDown from "../../vendor/libapps/hterm/images/keyboard_arrow_down.svg";
import imgKeyboardArrowUp from "../../vendor/libapps/hterm/images/keyboard_arrow_up.svg";
import pkg from "../../vendor/libapps/hterm/package.json";

export {
  auBell as AU_BELL,
  htmlFindBar as HTML_FIND_BAR,
  htmlFindScreen as HTML_FIND_SCREEN,
  imgClose as IMG_CLOSE,
  imgCopy as IMG_COPY,
  imgKeyboardArrowDown as IMG_KEYBOARD_ARROW_DOWN,
  imgKeyboardArrowUp as IMG_KEYBOARD_ARROW_UP,
  icon96 as IMG_ICON_96,
};

export const GIT_COMMIT = pkg.gitCommitHash || "";
export const GIT_DATE = pkg.gitDate || "";
export const VERSION = pkg.version || "";
