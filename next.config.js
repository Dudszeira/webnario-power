// Node.js 24 on Windows returns EISDIR from readlink on non-symlink paths.
// @vercel/nft and webpack enhanced-resolve expect EINVAL for non-symlinks.
// Patch fs.readlink, fs.promises.readlink, and graceful-fs before any plugin loads them.
function makeReadlinkPatch(orig) {
  return function patchedReadlink(p, optsOrCb, cb) {
    if (typeof optsOrCb === 'function') { cb = optsOrCb; optsOrCb = {}; }
    orig.call(this, p, optsOrCb, function(err, link) {
      if (err && err.code === 'EISDIR') {
        var e = new Error('EINVAL: invalid argument, readlink \'' + p + '\'');
        e.code = 'EINVAL'; e.syscall = 'readlink'; e.path = p;
        cb(e);
      } else { cb(err, link); }
    });
  };
}
function makeReadlinkPromisePatch(orig) {
  return function patchedReadlinkPromise(p, opts) {
    return orig.call(this, p, opts).catch(function(err) {
      if (err && err.code === 'EISDIR') {
        var e = new Error('EINVAL: invalid argument, readlink \'' + p + '\'');
        e.code = 'EINVAL'; e.syscall = 'readlink'; e.path = p;
        throw e;
      }
      throw err;
    });
  };
}
var _fs = require('fs');
if (!_fs._rlPatched) {
  _fs.readlink = makeReadlinkPatch(_fs.readlink);
  if (_fs.promises && _fs.promises.readlink) {
    _fs.promises.readlink = makeReadlinkPromisePatch(_fs.promises.readlink);
  }
  _fs._rlPatched = true;
}
try {
  var _gfs = require('graceful-fs');
  if (!_gfs._rlPatched) {
    if (_gfs.readlink) _gfs.readlink = makeReadlinkPatch(_gfs.readlink);
    _gfs._rlPatched = true;
  }
} catch (_) {}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  images: {
    formats: ['image/webp'],
  },
  webpack: (config) => {
    config.resolve.symlinks = false;
    config.cache = false;
    config.snapshot = {
      managedPaths: [],
      immutablePaths: [],
      buildDependencies: { hash: true, timestamp: false },
      module: { hash: true, timestamp: false },
      resolve: { hash: true, timestamp: false },
      resolveBuildDependencies: { hash: true, timestamp: false }
    };
    return config;
  },
};

module.exports = nextConfig;
