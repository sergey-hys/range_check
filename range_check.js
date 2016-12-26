;(function () {
    'use strict';

    let normalize = function (a) {
        if (!_validate(a)) {
            throw new Error('Invalid address: ' + a);
        }
        let nh = a.split(/\:\:/g);
        if (nh.length > 2) {
            throw new Error('Invalid address: ' + a);
        }

        let sections = [];
        if (nh.length == 1) {
            // full mode
            sections = a.split(/\:/g);
            if (sections.length !== 8) {
                throw new Error('Invalid address: ' + a);
            }
        } else if (nh.length == 2) {
            // compact mode
            let n = nh[0];
            let h = nh[1];
            let ns = n.split(/\:/g);
            let hs = h.split(/\:/g);
            for (let i in ns) {
                sections[i] = ns[i];
            }
            for (let i = hs.length; i > 0; --i) {
                sections[7 - (hs.length - i)] = hs[i - 1];
            }
        }
        for (let i = 0; i < 8; ++i) {
            if (sections[i] === undefined) {
                sections[i] = '0000';
            }
            sections[i] = _leftPad(sections[i], '0', 4);
        }
        return sections.join(':');
    };

    let abbreviate = function (a) {
        if (!_validate(a)) {
            throw new Error('Invalid address: ' + a);
        }
        a = normalize(a);
        a = a.replace(/0000/g, 'g');
        a = a.replace(/\:000/g, ':');
        a = a.replace(/\:00/g, ':');
        a = a.replace(/\:0/g, ':');
        a = a.replace(/g/g, '0');
        let sections = a.split(/\:/g);
        let zPreviousFlag = false;
        let zeroStartIndex = -1;
        let zeroLength = 0;
        let zStartIndex = -1;
        let zLength = 0;
        for (let i = 0; i < 8; ++i) {
            let section = sections[i];
            let zFlag = (section === '0');
            if (zFlag && !zPreviousFlag) {
                zStartIndex = i;
            }
            if (!zFlag && zPreviousFlag) {
                zLength = i - zStartIndex;
            }
            if (zLength > 1 && zLength > zeroLength) {
                zeroStartIndex = zStartIndex;
                zeroLength = zLength;
            }
            zPreviousFlag = (section === '0');
        }
        if (zPreviousFlag) {
            zLength = 8 - zStartIndex;
        }
        if (zLength > 1 && zLength > zeroLength) {
            zeroStartIndex = zStartIndex;
            zeroLength = zLength;
        }
        //console.log(zeroStartIndex, zeroLength);
        //console.log(sections);
        if (zeroStartIndex >= 0 && zeroLength > 1) {
            sections.splice(zeroStartIndex, zeroLength, 'g');
        }
        //console.log(sections);
        a = sections.join(':');
        //console.log(a);
        a = a.replace(/\:g\:/g, '::');
        a = a.replace(/\:g/g, '::');
        a = a.replace(/g\:/g, '::');
        a = a.replace(/g/g, '::');
        //console.log(a);
        return a;
    };

    // Basic validation
    let _validate = function (a) {
        return /^[a-f0-9\\:]+$/ig.test(a);
    };

    let _leftPad = function (d, p, n) {
        let padding = p.repeat(n);
        if (d.length < padding.length) {
            d = padding.substring(0, padding.length - d.length) + d;
        }
        return d;
    };

    let _hex2bin = function (hex) {
        return parseInt(hex, 16).toString(2)
    };
    let _bin2hex = function (bin) {
        return parseInt(bin, 2).toString(16)
    };

    let _addr2bin = function (addr) {
        let nAddr = normalize(addr);
        let sections = nAddr.split(":");
        let binAddr = '';
        for (let i in sections) {
            let part = sections[i];
            let section = _leftPad(_hex2bin(part), '0', 16);
            binAddr += section;
        }
        return binAddr;
    };

    let _bin2addr = function (bin) {
        let addr = [];
        for (let i = 0; i < 8; ++i) {
            let binPart = bin.substr(i * 16, 16);
            let hexSection = _leftPad(_bin2hex(binPart), '0', 4);
            addr.push(hexSection);
        }
        return addr.join(':');
    };

    let divideSubnet = function (addr, mask0, mask1, limit, abbr) {
        if (!_validate(addr)) {
            throw new Error('Invalid address: ' + addr);
        }
        mask0 *= 1;
        mask1 *= 1;
        limit *= 1;
        mask1 = mask1 || 128;
        if (mask0 < 1 || mask1 < 1 || mask0 > 128 || mask1 > 128 || mask0 > mask1) {
            throw new Error('Invalid masks.');
        }
        let ret = [];
        let binAddr = _addr2bin(addr);
        let binNetPart = binAddr.substr(0, mask0);
        let binHostPart = '0'.repeat(128 - mask1);
        let numSubnets = Math.pow(2, mask1 - mask0);
        for (let i = 0; i < numSubnets; ++i) {
            if (!!limit && i >= limit) {
                break;
            }
            let binSubnet = _leftPad(i.toString(2), '0', mask1 - mask0);
            let binSubAddr = binNetPart + binSubnet + binHostPart;
            let hexAddr = _bin2addr(binSubAddr);
            if (!!abbr) {
                ret.push(abbreviate(hexAddr));
            } else {
                ret.push(hexAddr);
            }

        }
        // console.log(numSubnets);
        // console.log(binNetPart, binSubnetPart, binHostPart);
        // console.log(binNetPart.length, binSubnetPart.length, binHostPart.length);
        // console.log(ret.length);
        return ret;
    };

    let range = function (addr, mask0, mask1, abbr) {
        if (!_validate(addr)) {
            throw new Error('Invalid address: ' + addr);
        }
        mask0 *= 1;
        mask1 *= 1;
        mask1 = mask1 || 128;
        if (mask0 < 1 || mask1 < 1 || mask0 > 128 || mask1 > 128 || mask0 > mask1) {
            throw new Error('Invalid masks.');
        }
        let binAddr = _addr2bin(addr);
        let binNetPart = binAddr.substr(0, mask0);
        let binHostPart = '0'.repeat(128 - mask1);
        let binStartAddr = binNetPart + '0'.repeat(mask1 - mask0) + binHostPart;
        let binEndAddr = binNetPart + '1'.repeat(mask1 - mask0) + binHostPart;
        if (!!abbr) {
            return {
                start: abbreviate(_bin2addr(binStartAddr)),
                end: abbreviate(_bin2addr(binEndAddr)),
                size: Math.pow(2, mask1 - mask0)
            };
        } else {
            return {
                start: _bin2addr(binStartAddr),
                end: _bin2addr(binEndAddr),
                size: Math.pow(2, mask1 - mask0)
            };
        }
    };

    let randomSubnet = function (addr, mask0, mask1, limit, abbr) {
        if (!_validate(addr)) {
            throw new Error('Invalid address: ' + addr);
        }
        mask0 *= 1;
        mask1 *= 1;
        limit *= 1;
        mask1 = mask1 || 128;
        limit = limit || 1;
        if (mask0 < 1 || mask1 < 1 || mask0 > 128 || mask1 > 128 || mask0 > mask1) {
            throw new Error('Invalid masks.');
        }
        let ret = [];
        let binAddr = _addr2bin(addr);
        let binNetPart = binAddr.substr(0, mask0);
        let binHostPart = '0'.repeat(128 - mask1);
        let numSubnets = Math.pow(2, mask1 - mask0);
        for (let i = 0; i < numSubnets && i < limit; ++i) {
            // generate an binary string with length of mask1 - mask0
            let binSubnet = '';
            for (let j = 0; j < mask1 - mask0; ++j) {
                binSubnet += Math.floor(Math.random() * 2);
            }
            let binSubAddr = binNetPart + binSubnet + binHostPart;
            let hexAddr = _bin2addr(binSubAddr);
            if (!!abbr) {
                ret.push(abbreviate(hexAddr));
            } else {
                ret.push(hexAddr);
            }
        }
        // console.log(numSubnets);
        // console.log(binNetPart, binSubnetPart, binHostPart);
        // console.log(binNetPart.length, binSubnetPart.length, binHostPart.length);
        // console.log(ret.length);
        return ret;
    };

    let ptr = function (addr, mask) {
        if (!_validate(addr)) {
            throw new Error('Invalid address: ' + addr);
        }
        mask *= 1;
        if (mask < 1 || mask > 128 || Math.floor(mask / 4) != mask / 4) {
            throw new Error('Invalid masks.');
        }
        let fullAddr = normalize(addr);
        let reverse = fullAddr.replace(/:/g, '').split('').reverse();
        return reverse.slice(0, (128 - mask) / 4).join('.');
    };

    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        exports.normalize = normalize;
        exports.abbreviate = abbreviate;
        exports.divideSubnet = divideSubnet;
        exports.range = range;
        exports.randomSubnet = randomSubnet;
        exports.ptr = ptr;
    } else {
        window.normalize = normalize;
        window.abbreviate = abbreviate;
        window.divideSubnet = divideSubnet;
        window.range = range;
        window.randomSubnet = randomSubnet;
        window.ptr = ptr;
    }
})();
(function() {
  var expandIPv6, ipaddr, ipv4Part, ipv4Regexes, ipv6Part, ipv6Regexes, matchCIDR, root;

  ipaddr = {};

  root = this;

  if ((typeof module !== "undefined" && module !== null) && module.exports) {
    module.exports = ipaddr;
  } else {
    root['ipaddr'] = ipaddr;
  }

  matchCIDR = function(first, second, partSize, cidrBits) {
    var part, shift;
    if (first.length !== second.length) {
      throw new Error("ipaddr: cannot match CIDR for objects with different lengths");
    }
    part = 0;
    while (cidrBits > 0) {
      shift = partSize - cidrBits;
      if (shift < 0) {
        shift = 0;
      }
      if (first[part] >> shift !== second[part] >> shift) {
        return false;
      }
      cidrBits -= partSize;
      part += 1;
    }
    return true;
  };

  ipaddr.subnetMatch = function(address, rangeList, defaultName) {
    var rangeName, rangeSubnets, subnet, _i, _len;
    if (defaultName == null) {
      defaultName = 'unicast';
    }
    for (rangeName in rangeList) {
      rangeSubnets = rangeList[rangeName];
      if (rangeSubnets[0] && !(rangeSubnets[0] instanceof Array)) {
        rangeSubnets = [rangeSubnets];
      }
      for (_i = 0, _len = rangeSubnets.length; _i < _len; _i++) {
        subnet = rangeSubnets[_i];
        if (address.match.apply(address, subnet)) {
          return rangeName;
        }
      }
    }
    return defaultName;
  };

  ipaddr.IPv4 = (function() {
    function IPv4(octets) {
      var octet, _i, _len;
      if (octets.length !== 4) {
        throw new Error("ipaddr: ipv4 octet count should be 4");
      }
      for (_i = 0, _len = octets.length; _i < _len; _i++) {
        octet = octets[_i];
        if (!((0 <= octet && octet <= 255))) {
          throw new Error("ipaddr: ipv4 octet should fit in 8 bits");
        }
      }
      this.octets = octets;
    }

    IPv4.prototype.kind = function() {
      return 'ipv4';
    };

    IPv4.prototype.toString = function() {
      return this.octets.join(".");
    };

    IPv4.prototype.toByteArray = function() {
      return this.octets.slice(0);
    };

    IPv4.prototype.match = function(other, cidrRange) {
      var _ref;
      if (cidrRange === void 0) {
        _ref = other, other = _ref[0], cidrRange = _ref[1];
      }
      if (other.kind() !== 'ipv4') {
        throw new Error("ipaddr: cannot match ipv4 address with non-ipv4 one");
      }
      return matchCIDR(this.octets, other.octets, 8, cidrRange);
    };

    IPv4.prototype.SpecialRanges = {
      unspecified: [[new IPv4([0, 0, 0, 0]), 8]],
      broadcast: [[new IPv4([255, 255, 255, 255]), 32]],
      multicast: [[new IPv4([224, 0, 0, 0]), 4]],
      linkLocal: [[new IPv4([169, 254, 0, 0]), 16]],
      loopback: [[new IPv4([127, 0, 0, 0]), 8]],
      "private": [[new IPv4([10, 0, 0, 0]), 8], [new IPv4([172, 16, 0, 0]), 12], [new IPv4([192, 168, 0, 0]), 16]],
      reserved: [[new IPv4([192, 0, 0, 0]), 24], [new IPv4([192, 0, 2, 0]), 24], [new IPv4([192, 88, 99, 0]), 24], [new IPv4([198, 51, 100, 0]), 24], [new IPv4([203, 0, 113, 0]), 24], [new IPv4([240, 0, 0, 0]), 4]]
    };

    IPv4.prototype.range = function() {
      return ipaddr.subnetMatch(this, this.SpecialRanges);
    };

    IPv4.prototype.toIPv4MappedAddress = function() {
      return ipaddr.IPv6.parse("::ffff:" + (this.toString()));
    };

    IPv4.prototype.prefixLengthFromSubnetMask = function() {
      var cidr, i, octet, stop, zeros, zerotable, _i;
      zerotable = {
        0: 8,
        128: 7,
        192: 6,
        224: 5,
        240: 4,
        248: 3,
        252: 2,
        254: 1,
        255: 0
      };
      cidr = 0;
      stop = false;
      for (i = _i = 3; _i >= 0; i = _i += -1) {
        octet = this.octets[i];
        if (octet in zerotable) {
          zeros = zerotable[octet];
          if (stop && zeros !== 0) {
            return null;
          }
          if (zeros !== 8) {
            stop = true;
          }
          cidr += zeros;
        } else {
          return null;
        }
      }
      return 32 - cidr;
    };

    return IPv4;

  })();

  ipv4Part = "(0?\\d+|0x[a-f0-9]+)";

  ipv4Regexes = {
    fourOctet: new RegExp("^" + ipv4Part + "\\." + ipv4Part + "\\." + ipv4Part + "\\." + ipv4Part + "$", 'i'),
    longValue: new RegExp("^" + ipv4Part + "$", 'i')
  };

  ipaddr.IPv4.parser = function(string) {
    var match, parseIntAuto, part, shift, value;
    parseIntAuto = function(string) {
      if (string[0] === "0" && string[1] !== "x") {
        return parseInt(string, 8);
      } else {
        return parseInt(string);
      }
    };
    if (match = string.match(ipv4Regexes.fourOctet)) {
      return (function() {
        var _i, _len, _ref, _results;
        _ref = match.slice(1, 6);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          part = _ref[_i];
          _results.push(parseIntAuto(part));
        }
        return _results;
      })();
    } else if (match = string.match(ipv4Regexes.longValue)) {
      value = parseIntAuto(match[1]);
      if (value > 0xffffffff || value < 0) {
        throw new Error("ipaddr: address outside defined range");
      }
      return ((function() {
        var _i, _results;
        _results = [];
        for (shift = _i = 0; _i <= 24; shift = _i += 8) {
          _results.push((value >> shift) & 0xff);
        }
        return _results;
      })()).reverse();
    } else {
      return null;
    }
  };

  ipaddr.IPv6 = (function() {
    function IPv6(parts) {
      var i, part, _i, _j, _len, _ref;
      if (parts.length === 16) {
        this.parts = [];
        for (i = _i = 0; _i <= 14; i = _i += 2) {
          this.parts.push((parts[i] << 8) | parts[i + 1]);
        }
      } else if (parts.length === 8) {
        this.parts = parts;
      } else {
        throw new Error("ipaddr: ipv6 part count should be 8 or 16");
      }
      _ref = this.parts;
      for (_j = 0, _len = _ref.length; _j < _len; _j++) {
        part = _ref[_j];
        if (!((0 <= part && part <= 0xffff))) {
          throw new Error("ipaddr: ipv6 part should fit in 16 bits");
        }
      }
    }

    IPv6.prototype.kind = function() {
      return 'ipv6';
    };

    IPv6.prototype.toString = function() {
      var compactStringParts, part, pushPart, state, stringParts, _i, _len;
      stringParts = (function() {
        var _i, _len, _ref, _results;
        _ref = this.parts;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          part = _ref[_i];
          _results.push(part.toString(16));
        }
        return _results;
      }).call(this);
      compactStringParts = [];
      pushPart = function(part) {
        return compactStringParts.push(part);
      };
      state = 0;
      for (_i = 0, _len = stringParts.length; _i < _len; _i++) {
        part = stringParts[_i];
        switch (state) {
          case 0:
            if (part === '0') {
              pushPart('');
            } else {
              pushPart(part);
            }
            state = 1;
            break;
          case 1:
            if (part === '0') {
              state = 2;
            } else {
              pushPart(part);
            }
            break;
          case 2:
            if (part !== '0') {
              pushPart('');
              pushPart(part);
              state = 3;
            }
            break;
          case 3:
            pushPart(part);
        }
      }
      if (state === 2) {
        pushPart('');
        pushPart('');
      }
      return compactStringParts.join(":");
    };

    IPv6.prototype.toByteArray = function() {
      var bytes, part, _i, _len, _ref;
      bytes = [];
      _ref = this.parts;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        part = _ref[_i];
        bytes.push(part >> 8);
        bytes.push(part & 0xff);
      }
      return bytes;
    };

    IPv6.prototype.toNormalizedString = function() {
      var part;
      return ((function() {
        var _i, _len, _ref, _results;
        _ref = this.parts;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          part = _ref[_i];
          _results.push(part.toString(16));
        }
        return _results;
      }).call(this)).join(":");
    };

    IPv6.prototype.match = function(other, cidrRange) {
      var _ref;
      if (cidrRange === void 0) {
        _ref = other, other = _ref[0], cidrRange = _ref[1];
      }
      if (other.kind() !== 'ipv6') {
        throw new Error("ipaddr: cannot match ipv6 address with non-ipv6 one");
      }
      return matchCIDR(this.parts, other.parts, 16, cidrRange);
    };

    IPv6.prototype.SpecialRanges = {
      unspecified: [new IPv6([0, 0, 0, 0, 0, 0, 0, 0]), 128],
      linkLocal: [new IPv6([0xfe80, 0, 0, 0, 0, 0, 0, 0]), 10],
      multicast: [new IPv6([0xff00, 0, 0, 0, 0, 0, 0, 0]), 8],
      loopback: [new IPv6([0, 0, 0, 0, 0, 0, 0, 1]), 128],
      uniqueLocal: [new IPv6([0xfc00, 0, 0, 0, 0, 0, 0, 0]), 7],
      ipv4Mapped: [new IPv6([0, 0, 0, 0, 0, 0xffff, 0, 0]), 96],
      rfc6145: [new IPv6([0, 0, 0, 0, 0xffff, 0, 0, 0]), 96],
      rfc6052: [new IPv6([0x64, 0xff9b, 0, 0, 0, 0, 0, 0]), 96],
      '6to4': [new IPv6([0x2002, 0, 0, 0, 0, 0, 0, 0]), 16],
      teredo: [new IPv6([0x2001, 0, 0, 0, 0, 0, 0, 0]), 32],
      reserved: [[new IPv6([0x2001, 0xdb8, 0, 0, 0, 0, 0, 0]), 32]]
    };

    IPv6.prototype.range = function() {
      return ipaddr.subnetMatch(this, this.SpecialRanges);
    };

    IPv6.prototype.isIPv4MappedAddress = function() {
      return this.range() === 'ipv4Mapped';
    };

    IPv6.prototype.toIPv4Address = function() {
      var high, low, _ref;
      if (!this.isIPv4MappedAddress()) {
        throw new Error("ipaddr: trying to convert a generic ipv6 address to ipv4");
      }
      _ref = this.parts.slice(-2), high = _ref[0], low = _ref[1];
      return new ipaddr.IPv4([high >> 8, high & 0xff, low >> 8, low & 0xff]);
    };

    return IPv6;

  })();

  ipv6Part = "(?:[0-9a-f]+::?)+";

  ipv6Regexes = {
    "native": new RegExp("^(::)?(" + ipv6Part + ")?([0-9a-f]+)?(::)?$", 'i'),
    transitional: new RegExp(("^((?:" + ipv6Part + ")|(?:::)(?:" + ipv6Part + ")?)") + ("" + ipv4Part + "\\." + ipv4Part + "\\." + ipv4Part + "\\." + ipv4Part + "$"), 'i')
  };

  expandIPv6 = function(string, parts) {
    var colonCount, lastColon, part, replacement, replacementCount;
    if (string.indexOf('::') !== string.lastIndexOf('::')) {
      return null;
    }
    colonCount = 0;
    lastColon = -1;
    while ((lastColon = string.indexOf(':', lastColon + 1)) >= 0) {
      colonCount++;
    }
    if (string.substr(0, 2) === '::') {
      colonCount--;
    }
    if (string.substr(-2, 2) === '::') {
      colonCount--;
    }
    if (colonCount > parts) {
      return null;
    }
    replacementCount = parts - colonCount;
    replacement = ':';
    while (replacementCount--) {
      replacement += '0:';
    }
    string = string.replace('::', replacement);
    if (string[0] === ':') {
      string = string.slice(1);
    }
    if (string[string.length - 1] === ':') {
      string = string.slice(0, -1);
    }
    return (function() {
      var _i, _len, _ref, _results;
      _ref = string.split(":");
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        part = _ref[_i];
        _results.push(parseInt(part, 16));
      }
      return _results;
    })();
  };

  ipaddr.IPv6.parser = function(string) {
    var match, octet, octets, parts, _i, _len;
    if (string.match(ipv6Regexes['native'])) {
      return expandIPv6(string, 8);
    } else if (match = string.match(ipv6Regexes['transitional'])) {
      parts = expandIPv6(match[1].slice(0, -1), 6);
      if (parts) {
        octets = [parseInt(match[2]), parseInt(match[3]), parseInt(match[4]), parseInt(match[5])];
        for (_i = 0, _len = octets.length; _i < _len; _i++) {
          octet = octets[_i];
          if (!((0 <= octet && octet <= 255))) {
            return null;
          }
        }
        parts.push(octets[0] << 8 | octets[1]);
        parts.push(octets[2] << 8 | octets[3]);
        return parts;
      }
    }
    return null;
  };

  ipaddr.IPv4.isIPv4 = ipaddr.IPv6.isIPv6 = function(string) {
    return this.parser(string) !== null;
  };

  ipaddr.IPv4.isValid = function(string) {
    var e;
    try {
      new this(this.parser(string));
      return true;
    } catch (_error) {
      e = _error;
      return false;
    }
  };

  ipaddr.IPv4.isValidFourPartDecimal = function(string) {
    if (ipaddr.IPv4.isValid(string) && string.match(/^\d+(\.\d+){3}$/)) {
      return true;
    } else {
      return false;
    }
  };

  ipaddr.IPv6.isValid = function(string) {
    var e;
    if (typeof string === "string" && string.indexOf(":") === -1) {
      return false;
    }
    try {
      new this(this.parser(string));
      return true;
    } catch (_error) {
      e = _error;
      return false;
    }
  };

  ipaddr.IPv4.parse = ipaddr.IPv6.parse = function(string) {
    var parts;
    parts = this.parser(string);
    if (parts === null) {
      throw new Error("ipaddr: string is not formatted like ip address");
    }
    return new this(parts);
  };

  ipaddr.IPv4.parseCIDR = function(string) {
    var maskLength, match;
    if (match = string.match(/^(.+)\/(\d+)$/)) {
      maskLength = parseInt(match[2]);
      if (maskLength >= 0 && maskLength <= 32) {
        return [this.parse(match[1]), maskLength];
      }
    }
    throw new Error("ipaddr: string is not formatted like an IPv4 CIDR range");
  };

  ipaddr.IPv6.parseCIDR = function(string) {
    var maskLength, match;
    if (match = string.match(/^(.+)\/(\d+)$/)) {
      maskLength = parseInt(match[2]);
      if (maskLength >= 0 && maskLength <= 128) {
        return [this.parse(match[1]), maskLength];
      }
    }
    throw new Error("ipaddr: string is not formatted like an IPv6 CIDR range");
  };

  ipaddr.isValid = function(string) {
    return ipaddr.IPv6.isValid(string) || ipaddr.IPv4.isValid(string);
  };

  ipaddr.parse = function(string) {
    if (ipaddr.IPv6.isValid(string)) {
      return ipaddr.IPv6.parse(string);
    } else if (ipaddr.IPv4.isValid(string)) {
      return ipaddr.IPv4.parse(string);
    } else {
      throw new Error("ipaddr: the address has neither IPv6 nor IPv4 format");
    }
  };

  ipaddr.parseCIDR = function(string) {
    var e;
    try {
      return ipaddr.IPv6.parseCIDR(string);
    } catch (_error) {
      e = _error;
      try {
        return ipaddr.IPv4.parseCIDR(string);
      } catch (_error) {
        e = _error;
        throw new Error("ipaddr: the address has neither IPv6 nor IPv4 CIDR format");
      }
    }
  };

  ipaddr.fromByteArray = function(bytes) {
    var length;
    length = bytes.length;
    if (length === 4) {
      return new ipaddr.IPv4(bytes);
    } else if (length === 16) {
      return new ipaddr.IPv6(bytes);
    } else {
      throw new Error("ipaddr: the binary input is neither an IPv6 nor IPv4 address");
    }
  };

  ipaddr.process = function(string) {
    var addr;
    addr = this.parse(string);
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      return addr.toIPv4Address();
    } else {
      return addr;
    }
  };

}).call(this);

(function ()
{
    var ipaddr = require('ipaddr.js'),
        ip6 = require('ip6');

    function isIP(addr)
    {
        return ipaddr.isValid(addr);
    }

    function isRange(range)
    {
        try {
            var cidr = ipaddr.parseCIDR(range);
            return true;
        } catch(err) {
            return false;
        }

    }

    function ver(addr)
    {
        try {
            var parse_addr = ipaddr.parse(addr);
            var kind = parse_addr.kind();

            if (kind === 'ipv4')
            {
                return 4; //IPv4
            }
            else if (kind === 'ipv6')
            {
                return 6; //IPv6
            }
            else
            {
                return 0; //not 4 or 6
            }

        }
        catch(err) {
            return 0; //not 4 or 6
        }

    }

    function isV4(addr)
    {
        return (ver(addr) === 4);
    }

    function isV6(addr)
    {
        return (ver(addr) === 6);
    }

    function storeIP(addr)
    {
        try {
            var parse_addr = ipaddr.parse(addr);
            var kind = parse_addr.kind();

            if (kind === 'ipv4') //is a plain v4 address
            {
                return addr;
            }
            else if (kind === 'ipv6')
            {
                if (parse_addr.isIPv4MappedAddress()) //convert v4 mapped to v6 addresses to a v4 in it's original format
                {
                    return parse_addr.toIPv4Address().toString();
                }
                else //is a v6, abbreviate it
                {
                    return ip6.abbreviate(addr);
                }

            }
            else
            {
                return null; //invalid IP address
            }

        }
        catch(err) {
            return null; //invalid IP address
        }

    }

    function displayIP(addr)
    {
        try {
            var parse_addr = ipaddr.parse(addr);
            var kind = parse_addr.kind();

            if (kind === 'ipv4') //is a plain v4 address
            {
                return addr;
            }
            else if (kind === 'ipv6')
            {
                if (parse_addr.isIPv4MappedAddress()) //convert v4 mapped to v6 addresses to a v4 in it's original format
                {
                    return parse_addr.toIPv4Address().toString();
                }
                else //is a v6, normalize it
                {
                    return ip6.normalize(addr);
                }

            }
            else
            {
                return ''; //invalid IP address
            }

        }
        catch(err) {
            return ''; //invalid IP address
        }

    }

    function inRange(addr, range)
    {
        if (typeof range === 'string')
        {
            if (range.indexOf('/') !== -1)
            {
                try {
                    var range_data = range.split('/');

                    var parse_addr = ipaddr.parse(addr);
                    var parse_range = ipaddr.parse(range_data[0]);

                    return parse_addr.match(parse_range, range_data[1]);
                }
                catch(err) {
                    return false;
                }
            }
            else
            {
                addr = (isV6(addr)) ? ip6.normalize(addr) : addr; //v6 normalize addr
                range = (isV6(range)) ? ip6.normalize(range) : range; //v6 normalize range

                return isIP(range) && addr === range;
            }
        }
        else if (range && typeof range === 'object') //list
        {
            for (var check_range in range)
            {
                if (inRange(addr, range[check_range]) === true)
                {
                    return true;
                }
            }
            return false;
        }
        else
        {
            return false;
        }
    }

    // Export public API
    var range_check = {};
    //Validate IP Address
    range_check.vaild_ip = range_check.vaildIp = isIP;
    range_check.valid_ip = range_check.validIp = isIP;
    range_check.isIP = isIP;

    //isV4 and isV6
    range_check.isV4 = isV4;
    range_check.isV6 = isV6;

    //storeIP, searchIP and displayIP
    range_check.storeIP = storeIP;
    range_check.searchIP = storeIP;
    range_check.displayIP = displayIP;

    //Validate Range
    range_check.valid_range = range_check.validRange = isRange;
    range_check.isRange = isRange;

    //Others
    range_check.ver = ver;
    range_check.in_range = range_check.inRange = inRange;

    module.exports = range_check;
}());
