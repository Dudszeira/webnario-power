// Windows Node.js 22+ returns EISDIR from readlink on regular files instead
// of EINVAL. webpack / enhanced-resolve / @vercel/nft expect EINVAL to skip
// symlink resolution. This patch must be loaded before any of those modules.
'use strict';
var fs = require('fs');

function wrapCb(orig) {
  return function(p, optsOrCb, cb) {
    if (typeof optsOrCb === 'function') { cb = optsOrCb; optsOrCb = {}; }
    orig.call(this, p, optsOrCb, function(err, link) {
      if (err && err.code === 'EISDIR') {
        var e = new Error("EINVAL: invalid argument, readlink '" + p + "'");
        e.code = 'EINVAL'; e.syscall = 'readlink'; e.path = p;
        return cb(e);
      }
      cb(err, link);
    });
  };
}

function wrapPromise(orig) {
  return function(p, opts) {
    return orig.call(this, p, opts).catch(function(err) {
      if (err && err.code === 'EISDIR') {
        var e = new Error("EINVAL: invalid argument, readlink '" + p + "'");
        e.code = 'EINVAL'; e.syscall = 'readlink'; e.path = p;
        throw e;
      }
      throw err;
    });
  };
}

if (!fs._rlPatched) {
  fs.readlink = wrapCb(fs.readlink);
  if (fs.promises && fs.promises.readlink) {
    fs.promises.readlink = wrapPromise(fs.promises.readlink);
  }
  fs._rlPatched = true;
}

try {
  var gfs = require('graceful-fs');
  if (!gfs._rlPatched) {
    if (gfs.readlink) gfs.readlink = wrapCb(gfs.readlink);
    gfs._rlPatched = true;
  }
} catch (_) {}