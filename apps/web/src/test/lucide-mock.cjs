const React = require('react');
module.exports = new Proxy({ __esModule: true }, {
  get(target, prop) {
    if (prop === '__esModule') return true;
    if (!(prop in target)) target[prop] = (props) => React.createElement('svg', { ...props, 'data-icon': String(prop) });
    return target[prop];
  },
});
