// node_modules/.pnpm/croner@10.0.1/node_modules/croner/dist/croner.js
function T(s2) {
  return Date.UTC(s2.y, s2.m - 1, s2.d, s2.h, s2.i, s2.s);
}
function D(s2, e) {
  return s2.y === e.y && s2.m === e.m && s2.d === e.d && s2.h === e.h && s2.i === e.i && s2.s === e.s;
}
function A(s2, e) {
  let t = new Date(Date.parse(s2));
  if (isNaN(t)) throw new Error("Invalid ISO8601 passed to timezone parser.");
  let r = s2.substring(9);
  return r.includes("Z") || r.includes("+") || r.includes("-") ? b(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds(), "Etc/UTC") : b(t.getFullYear(), t.getMonth() + 1, t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds(), e);
}
function v(s2, e, t) {
  return k(A(s2, e), t);
}
function k(s2, e) {
  let t = new Date(T(s2)), r = g(t, s2.tz), n = T(s2), i = T(r), a = n - i, o = new Date(t.getTime() + a), h = g(o, s2.tz);
  if (D(h, s2)) {
    let u = new Date(o.getTime() - 36e5), d = g(u, s2.tz);
    return D(d, s2) ? u : o;
  }
  let l = new Date(o.getTime() + T(s2) - T(h)), y = g(l, s2.tz);
  if (D(y, s2)) return l;
  if (e) throw new Error("Invalid date passed to fromTZ()");
  return o.getTime() > l.getTime() ? o : l;
}
function g(s2, e) {
  let t, r;
  try {
    t = new Intl.DateTimeFormat("en-US", { timeZone: e, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }), r = t.formatToParts(s2);
  } catch (i) {
    let a = i instanceof Error ? i.message : String(i);
    throw new RangeError(`toTZ: Invalid timezone '${e}' or date. Please provide a valid IANA timezone (e.g., 'America/New_York', 'Europe/Stockholm'). Original error: ${a}`);
  }
  let n = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (let i of r) (i.type === "year" || i.type === "month" || i.type === "day" || i.type === "hour" || i.type === "minute" || i.type === "second") && (n[i.type] = parseInt(i.value, 10));
  if (isNaN(n.year) || isNaN(n.month) || isNaN(n.day) || isNaN(n.hour) || isNaN(n.minute) || isNaN(n.second)) throw new Error(`toTZ: Failed to parse all date components from timezone '${e}'. This may indicate an invalid date or timezone configuration. Parsed components: ${JSON.stringify(n)}`);
  return n.hour === 24 && (n.hour = 0), { y: n.year, m: n.month, d: n.day, h: n.hour, i: n.minute, s: n.second, tz: e };
}
function b(s2, e, t, r, n, i, a) {
  return { y: s2, m: e, d: t, h: r, i: n, s: i, tz: a };
}
var O = [1, 2, 4, 8, 16];
var C = class {
  pattern;
  timezone;
  mode;
  alternativeWeekdays;
  sloppyRanges;
  second;
  minute;
  hour;
  day;
  month;
  dayOfWeek;
  year;
  lastDayOfMonth;
  lastWeekday;
  nearestWeekdays;
  starDOM;
  starDOW;
  starYear;
  useAndLogic;
  constructor(e, t, r) {
    this.pattern = e, this.timezone = t, this.mode = r?.mode ?? "auto", this.alternativeWeekdays = r?.alternativeWeekdays ?? false, this.sloppyRanges = r?.sloppyRanges ?? false, this.second = Array(60).fill(0), this.minute = Array(60).fill(0), this.hour = Array(24).fill(0), this.day = Array(31).fill(0), this.month = Array(12).fill(0), this.dayOfWeek = Array(7).fill(0), this.year = Array(1e4).fill(0), this.lastDayOfMonth = false, this.lastWeekday = false, this.nearestWeekdays = Array(31).fill(0), this.starDOM = false, this.starDOW = false, this.starYear = false, this.useAndLogic = false, this.parse();
  }
  parse() {
    if (!(typeof this.pattern == "string" || this.pattern instanceof String)) throw new TypeError("CronPattern: Pattern has to be of type string.");
    this.pattern.indexOf("@") >= 0 && (this.pattern = this.handleNicknames(this.pattern).trim());
    let e = this.pattern.match(/\S+/g) || [""], t = e.length;
    if (e.length < 5 || e.length > 7) throw new TypeError("CronPattern: invalid configuration format ('" + this.pattern + "'), exactly five, six, or seven space separated parts are required.");
    if (this.mode !== "auto") {
      let n;
      switch (this.mode) {
        case "5-part":
          n = 5;
          break;
        case "6-part":
          n = 6;
          break;
        case "7-part":
          n = 7;
          break;
        case "5-or-6-parts":
          n = [5, 6];
          break;
        case "6-or-7-parts":
          n = [6, 7];
          break;
        default:
          n = 0;
      }
      if (!(Array.isArray(n) ? n.includes(t) : t === n)) {
        let a = Array.isArray(n) ? n.join(" or ") : n.toString();
        throw new TypeError(`CronPattern: mode '${this.mode}' requires exactly ${a} parts, but pattern '${this.pattern}' has ${t} parts.`);
      }
    }
    if (e.length === 5 && e.unshift("0"), e.length === 6 && e.push("*"), e[3].toUpperCase() === "LW" ? (this.lastWeekday = true, e[3] = "") : e[3].toUpperCase().indexOf("L") >= 0 && (e[3] = e[3].replace(/L/gi, ""), this.lastDayOfMonth = true), e[3] == "*" && (this.starDOM = true), e[6] == "*" && (this.starYear = true), e[4].length >= 3 && (e[4] = this.replaceAlphaMonths(e[4])), e[5].length >= 3 && (e[5] = this.alternativeWeekdays ? this.replaceAlphaDaysQuartz(e[5]) : this.replaceAlphaDays(e[5])), e[5].startsWith("+") && (this.useAndLogic = true, e[5] = e[5].substring(1), e[5] === "")) throw new TypeError("CronPattern: Day-of-week field cannot be empty after '+' modifier.");
    switch (e[5] == "*" && (this.starDOW = true), this.pattern.indexOf("?") >= 0 && (e[0] = e[0].replace(/\?/g, "*"), e[1] = e[1].replace(/\?/g, "*"), e[2] = e[2].replace(/\?/g, "*"), e[3] = e[3].replace(/\?/g, "*"), e[4] = e[4].replace(/\?/g, "*"), e[5] = e[5].replace(/\?/g, "*"), e[6] && (e[6] = e[6].replace(/\?/g, "*"))), this.mode) {
      case "5-part":
        e[0] = "0", e[6] = "*";
        break;
      case "6-part":
        e[6] = "*";
        break;
      case "5-or-6-parts":
        e[6] = "*";
        break;
      case "6-or-7-parts":
        break;
      case "7-part":
      case "auto":
        break;
    }
    this.throwAtIllegalCharacters(e), this.partToArray("second", e[0], 0, 1), this.partToArray("minute", e[1], 0, 1), this.partToArray("hour", e[2], 0, 1), this.partToArray("day", e[3], -1, 1), this.partToArray("month", e[4], -1, 1);
    let r = this.alternativeWeekdays ? -1 : 0;
    this.partToArray("dayOfWeek", e[5], r, 63), this.partToArray("year", e[6], 0, 1), !this.alternativeWeekdays && this.dayOfWeek[7] && (this.dayOfWeek[0] = this.dayOfWeek[7]);
  }
  partToArray(e, t, r, n) {
    let i = this[e], a = e === "day" && this.lastDayOfMonth, o = e === "day" && this.lastWeekday;
    if (t === "" && !a && !o) throw new TypeError("CronPattern: configuration entry " + e + " (" + t + ") is empty, check for trailing spaces.");
    if (t === "*") return i.fill(n);
    let h = t.split(",");
    if (h.length > 1) for (let l = 0; l < h.length; l++) this.partToArray(e, h[l], r, n);
    else t.indexOf("-") !== -1 && t.indexOf("/") !== -1 ? this.handleRangeWithStepping(t, e, r, n) : t.indexOf("-") !== -1 ? this.handleRange(t, e, r, n) : t.indexOf("/") !== -1 ? this.handleStepping(t, e, r, n) : t !== "" && this.handleNumber(t, e, r, n);
  }
  throwAtIllegalCharacters(e) {
    for (let t = 0; t < e.length; t++) if ((t === 3 ? /[^/*0-9,\-WwLl]+/ : t === 5 ? /[^/*0-9,\-#Ll]+/ : /[^/*0-9,\-]+/).test(e[t])) throw new TypeError("CronPattern: configuration entry " + t + " (" + e[t] + ") contains illegal characters.");
  }
  handleNumber(e, t, r, n) {
    let i = this.extractNth(e, t), a = e.toUpperCase().includes("W");
    if (t !== "day" && a) throw new TypeError("CronPattern: Nearest weekday modifier (W) only allowed in day-of-month.");
    a && (t = "nearestWeekdays");
    let o = parseInt(i[0], 10) + r;
    if (isNaN(o)) throw new TypeError("CronPattern: " + t + " is not a number: '" + e + "'");
    this.setPart(t, o, i[1] || n);
  }
  setPart(e, t, r) {
    if (!Object.prototype.hasOwnProperty.call(this, e)) throw new TypeError("CronPattern: Invalid part specified: " + e);
    if (e === "dayOfWeek") {
      if (t === 7 && (t = 0), t < 0 || t > 6) throw new RangeError("CronPattern: Invalid value for dayOfWeek: " + t);
      this.setNthWeekdayOfMonth(t, r);
      return;
    }
    if (e === "second" || e === "minute") {
      if (t < 0 || t >= 60) throw new RangeError("CronPattern: Invalid value for " + e + ": " + t);
    } else if (e === "hour") {
      if (t < 0 || t >= 24) throw new RangeError("CronPattern: Invalid value for " + e + ": " + t);
    } else if (e === "day" || e === "nearestWeekdays") {
      if (t < 0 || t >= 31) throw new RangeError("CronPattern: Invalid value for " + e + ": " + t);
    } else if (e === "month") {
      if (t < 0 || t >= 12) throw new RangeError("CronPattern: Invalid value for " + e + ": " + t);
    } else if (e === "year" && (t < 1 || t >= 1e4)) throw new RangeError("CronPattern: Invalid value for " + e + ": " + t + " (supported range: 1-9999)");
    this[e][t] = r;
  }
  validateNotNaN(e, t) {
    if (isNaN(e)) throw new TypeError(t);
  }
  validateRange(e, t, r, n, i) {
    if (e > t) throw new TypeError("CronPattern: From value is larger than to value: '" + i + "'");
    if (r !== void 0) {
      if (r === 0) throw new TypeError("CronPattern: Syntax error, illegal stepping: 0");
      if (r > this[n].length) throw new TypeError("CronPattern: Syntax error, steps cannot be greater than maximum value of part (" + this[n].length + ")");
    }
  }
  handleRangeWithStepping(e, t, r, n) {
    if (e.toUpperCase().includes("W")) throw new TypeError("CronPattern: Syntax error, W is not allowed in ranges with stepping.");
    let i = this.extractNth(e, t), a = i[0].match(/^(\d+)-(\d+)\/(\d+)$/);
    if (a === null) throw new TypeError("CronPattern: Syntax error, illegal range with stepping: '" + e + "'");
    let [, o, h, l] = a, y = parseInt(o, 10) + r, u = parseInt(h, 10) + r, d = parseInt(l, 10);
    this.validateNotNaN(y, "CronPattern: Syntax error, illegal lower range (NaN)"), this.validateNotNaN(u, "CronPattern: Syntax error, illegal upper range (NaN)"), this.validateNotNaN(d, "CronPattern: Syntax error, illegal stepping: (NaN)"), this.validateRange(y, u, d, t, e);
    for (let c = y; c <= u; c += d) this.setPart(t, c, i[1] || n);
  }
  extractNth(e, t) {
    let r = e, n;
    if (r.includes("#")) {
      if (t !== "dayOfWeek") throw new Error("CronPattern: nth (#) only allowed in day-of-week field");
      n = r.split("#")[1], r = r.split("#")[0];
    } else if (r.toUpperCase().endsWith("L")) {
      if (t !== "dayOfWeek") throw new Error("CronPattern: L modifier only allowed in day-of-week field (use L alone for day-of-month)");
      n = "L", r = r.slice(0, -1);
    }
    return [r, n];
  }
  handleRange(e, t, r, n) {
    if (e.toUpperCase().includes("W")) throw new TypeError("CronPattern: Syntax error, W is not allowed in a range.");
    let i = this.extractNth(e, t), a = i[0].split("-");
    if (a.length !== 2) throw new TypeError("CronPattern: Syntax error, illegal range: '" + e + "'");
    let o = parseInt(a[0], 10) + r, h = parseInt(a[1], 10) + r;
    this.validateNotNaN(o, "CronPattern: Syntax error, illegal lower range (NaN)"), this.validateNotNaN(h, "CronPattern: Syntax error, illegal upper range (NaN)"), this.validateRange(o, h, void 0, t, e);
    for (let l = o; l <= h; l++) this.setPart(t, l, i[1] || n);
  }
  handleStepping(e, t, r, n) {
    if (e.toUpperCase().includes("W")) throw new TypeError("CronPattern: Syntax error, W is not allowed in parts with stepping.");
    let i = this.extractNth(e, t), a = i[0].split("/");
    if (a.length !== 2) throw new TypeError("CronPattern: Syntax error, illegal stepping: '" + e + "'");
    if (this.sloppyRanges) a[0] === "" && (a[0] = "*");
    else {
      if (a[0] === "") throw new TypeError("CronPattern: Syntax error, stepping with missing prefix ('" + e + "') is not allowed. Use wildcard (*/step) or range (min-max/step) instead.");
      if (a[0] !== "*") throw new TypeError("CronPattern: Syntax error, stepping with numeric prefix ('" + e + "') is not allowed. Use wildcard (*/step) or range (min-max/step) instead.");
    }
    let o = 0;
    a[0] !== "*" && (o = parseInt(a[0], 10) + r);
    let h = parseInt(a[1], 10);
    this.validateNotNaN(h, "CronPattern: Syntax error, illegal stepping: (NaN)"), this.validateRange(0, this[t].length - 1, h, t, e);
    for (let l = o; l < this[t].length; l += h) this.setPart(t, l, i[1] || n);
  }
  replaceAlphaDays(e) {
    return e.replace(/-sun/gi, "-7").replace(/sun/gi, "0").replace(/mon/gi, "1").replace(/tue/gi, "2").replace(/wed/gi, "3").replace(/thu/gi, "4").replace(/fri/gi, "5").replace(/sat/gi, "6");
  }
  replaceAlphaDaysQuartz(e) {
    return e.replace(/sun/gi, "1").replace(/mon/gi, "2").replace(/tue/gi, "3").replace(/wed/gi, "4").replace(/thu/gi, "5").replace(/fri/gi, "6").replace(/sat/gi, "7");
  }
  replaceAlphaMonths(e) {
    return e.replace(/jan/gi, "1").replace(/feb/gi, "2").replace(/mar/gi, "3").replace(/apr/gi, "4").replace(/may/gi, "5").replace(/jun/gi, "6").replace(/jul/gi, "7").replace(/aug/gi, "8").replace(/sep/gi, "9").replace(/oct/gi, "10").replace(/nov/gi, "11").replace(/dec/gi, "12");
  }
  handleNicknames(e) {
    let t = e.trim().toLowerCase();
    if (t === "@yearly" || t === "@annually") return "0 0 1 1 *";
    if (t === "@monthly") return "0 0 1 * *";
    if (t === "@weekly") return "0 0 * * 0";
    if (t === "@daily" || t === "@midnight") return "0 0 * * *";
    if (t === "@hourly") return "0 * * * *";
    if (t === "@reboot") throw new TypeError("CronPattern: @reboot is not supported in this environment. This is an event-based trigger that requires system startup detection.");
    return e;
  }
  setNthWeekdayOfMonth(e, t) {
    if (typeof t != "number" && t.toUpperCase() === "L") this.dayOfWeek[e] = this.dayOfWeek[e] | 32;
    else if (t === 63) this.dayOfWeek[e] = 63;
    else if (t < 6 && t > 0) this.dayOfWeek[e] = this.dayOfWeek[e] | O[t - 1];
    else throw new TypeError(`CronPattern: nth weekday out of range, should be 1-5 or L. Value: ${t}, Type: ${typeof t}`);
  }
};
var P = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var f = [["month", "year", 0], ["day", "month", -1], ["hour", "day", 0], ["minute", "hour", 0], ["second", "minute", 0]];
var m = class s {
  tz;
  ms;
  second;
  minute;
  hour;
  day;
  month;
  year;
  constructor(e, t) {
    if (this.tz = t, e && e instanceof Date) if (!isNaN(e)) this.fromDate(e);
    else throw new TypeError("CronDate: Invalid date passed to CronDate constructor");
    else if (e == null) this.fromDate(/* @__PURE__ */ new Date());
    else if (e && typeof e == "string") this.fromString(e);
    else if (e instanceof s) this.fromCronDate(e);
    else throw new TypeError("CronDate: Invalid type (" + typeof e + ") passed to CronDate constructor");
  }
  getLastDayOfMonth(e, t) {
    return t !== 1 ? P[t] : new Date(Date.UTC(e, t + 1, 0)).getUTCDate();
  }
  getLastWeekday(e, t) {
    let r = this.getLastDayOfMonth(e, t), i = new Date(Date.UTC(e, t, r)).getUTCDay();
    return i === 0 ? r - 2 : i === 6 ? r - 1 : r;
  }
  getNearestWeekday(e, t, r) {
    let n = this.getLastDayOfMonth(e, t);
    if (r > n) return -1;
    let a = new Date(Date.UTC(e, t, r)).getUTCDay();
    return a === 0 ? r === n ? r - 2 : r + 1 : a === 6 ? r === 1 ? r + 2 : r - 1 : r;
  }
  isNthWeekdayOfMonth(e, t, r, n) {
    let a = new Date(Date.UTC(e, t, r)).getUTCDay(), o = 0;
    for (let h = 1; h <= r; h++) new Date(Date.UTC(e, t, h)).getUTCDay() === a && o++;
    if (n & 63 && O[o - 1] & n) return true;
    if (n & 32) {
      let h = this.getLastDayOfMonth(e, t);
      for (let l = r + 1; l <= h; l++) if (new Date(Date.UTC(e, t, l)).getUTCDay() === a) return false;
      return true;
    }
    return false;
  }
  fromDate(e) {
    if (this.tz !== void 0) if (typeof this.tz == "number") this.ms = e.getUTCMilliseconds(), this.second = e.getUTCSeconds(), this.minute = e.getUTCMinutes() + this.tz, this.hour = e.getUTCHours(), this.day = e.getUTCDate(), this.month = e.getUTCMonth(), this.year = e.getUTCFullYear(), this.apply();
    else try {
      let t = g(e, this.tz);
      this.ms = e.getMilliseconds(), this.second = t.s, this.minute = t.i, this.hour = t.h, this.day = t.d, this.month = t.m - 1, this.year = t.y;
    } catch (t) {
      let r = t instanceof Error ? t.message : String(t);
      throw new TypeError(`CronDate: Failed to convert date to timezone '${this.tz}'. This may happen with invalid timezone names or dates. Original error: ${r}`);
    }
    else this.ms = e.getMilliseconds(), this.second = e.getSeconds(), this.minute = e.getMinutes(), this.hour = e.getHours(), this.day = e.getDate(), this.month = e.getMonth(), this.year = e.getFullYear();
  }
  fromCronDate(e) {
    this.tz = e.tz, this.year = e.year, this.month = e.month, this.day = e.day, this.hour = e.hour, this.minute = e.minute, this.second = e.second, this.ms = e.ms;
  }
  apply() {
    if (this.month > 11 || this.month < 0 || this.day > P[this.month] || this.day < 1 || this.hour > 59 || this.minute > 59 || this.second > 59 || this.hour < 0 || this.minute < 0 || this.second < 0) {
      let e = new Date(Date.UTC(this.year, this.month, this.day, this.hour, this.minute, this.second, this.ms));
      return this.ms = e.getUTCMilliseconds(), this.second = e.getUTCSeconds(), this.minute = e.getUTCMinutes(), this.hour = e.getUTCHours(), this.day = e.getUTCDate(), this.month = e.getUTCMonth(), this.year = e.getUTCFullYear(), true;
    } else return false;
  }
  fromString(e) {
    if (typeof this.tz == "number") {
      let t = v(e);
      this.ms = t.getUTCMilliseconds(), this.second = t.getUTCSeconds(), this.minute = t.getUTCMinutes(), this.hour = t.getUTCHours(), this.day = t.getUTCDate(), this.month = t.getUTCMonth(), this.year = t.getUTCFullYear(), this.apply();
    } else return this.fromDate(v(e, this.tz));
  }
  findNext(e, t, r, n) {
    return this._findMatch(e, t, r, n, 1);
  }
  _findMatch(e, t, r, n, i) {
    let a = this[t], o;
    r.lastDayOfMonth && (o = this.getLastDayOfMonth(this.year, this.month));
    let h = !r.starDOW && t == "day" ? new Date(Date.UTC(this.year, this.month, 1, 0, 0, 0, 0)).getUTCDay() : void 0, l = this[t] + n, y = i === 1 ? (u) => u < r[t].length : (u) => u >= 0;
    for (let u = l; y(u); u += i) {
      let d = r[t][u];
      if (t === "day" && !d) {
        for (let c = 0; c < r.nearestWeekdays.length; c++) if (r.nearestWeekdays[c]) {
          let M = this.getNearestWeekday(this.year, this.month, c - n);
          if (M === -1) continue;
          if (M === u - n) {
            d = 1;
            break;
          }
        }
      }
      if (t === "day" && r.lastWeekday) {
        let c = this.getLastWeekday(this.year, this.month);
        u - n === c && (d = 1);
      }
      if (t === "day" && r.lastDayOfMonth && u - n == o && (d = 1), t === "day" && !r.starDOW) {
        let c = r.dayOfWeek[(h + (u - n - 1)) % 7];
        if (c && c & 63) c = this.isNthWeekdayOfMonth(this.year, this.month, u - n, c) ? 1 : 0;
        else if (c) throw new Error(`CronDate: Invalid value for dayOfWeek encountered. ${c}`);
        r.useAndLogic ? d = d && c : !e.domAndDow && !r.starDOM ? d = d || c : d = d && c;
      }
      if (d) return this[t] = u - n, a !== this[t] ? 2 : 1;
    }
    return 3;
  }
  recurse(e, t, r) {
    if (r === 0 && !e.starYear) {
      if (this.year >= 0 && this.year < e.year.length && e.year[this.year] === 0) {
        let i = -1;
        for (let a = this.year + 1; a < e.year.length && a < 1e4; a++) if (e.year[a] === 1) {
          i = a;
          break;
        }
        if (i === -1) return null;
        this.year = i, this.month = 0, this.day = 1, this.hour = 0, this.minute = 0, this.second = 0, this.ms = 0;
      }
      if (this.year >= 1e4) return null;
    }
    let n = this.findNext(t, f[r][0], e, f[r][2]);
    if (n > 1) {
      let i = r + 1;
      for (; i < f.length; ) this[f[i][0]] = -f[i][2], i++;
      if (n === 3) {
        if (this[f[r][1]]++, this[f[r][0]] = -f[r][2], this.apply(), r === 0 && !e.starYear) {
          for (; this.year >= 0 && this.year < e.year.length && e.year[this.year] === 0 && this.year < 1e4; ) this.year++;
          if (this.year >= 1e4 || this.year >= e.year.length) return null;
        }
        return this.recurse(e, t, 0);
      } else if (this.apply()) return this.recurse(e, t, r - 1);
    }
    return r += 1, r >= f.length ? this : (e.starYear ? this.year >= 3e3 : this.year >= 1e4) ? null : this.recurse(e, t, r);
  }
  increment(e, t, r) {
    return this.second += t.interval !== void 0 && t.interval > 1 && r ? t.interval : 1, this.ms = 0, this.apply(), this.recurse(e, t, 0);
  }
  decrement(e, t) {
    return this.second -= t.interval !== void 0 && t.interval > 1 ? t.interval : 1, this.ms = 0, this.apply(), this.recurseBackward(e, t, 0, 0);
  }
  recurseBackward(e, t, r, n = 0) {
    if (n > 1e4) return null;
    if (r === 0 && !e.starYear) {
      if (this.year >= 0 && this.year < e.year.length && e.year[this.year] === 0) {
        let a = -1;
        for (let o = this.year - 1; o >= 0; o--) if (e.year[o] === 1) {
          a = o;
          break;
        }
        if (a === -1) return null;
        this.year = a, this.month = 11, this.day = 31, this.hour = 23, this.minute = 59, this.second = 59, this.ms = 0;
      }
      if (this.year < 0) return null;
    }
    let i = this.findPrevious(t, f[r][0], e, f[r][2]);
    if (i > 1) {
      let a = r + 1;
      for (; a < f.length; ) {
        let o = f[a][0], h = f[a][2], l = this.getMaxPatternValue(o, e, h);
        this[o] = l, a++;
      }
      if (i === 3) {
        if (this[f[r][1]]--, r === 0) {
          let y = this.getLastDayOfMonth(this.year, this.month);
          this.day > y && (this.day = y);
        }
        if (r === 1) if (this.day <= 0) this.day = 1;
        else {
          let y = this.year, u = this.month;
          for (; u < 0; ) u += 12, y--;
          for (; u > 11; ) u -= 12, y++;
          let d = u !== 1 ? P[u] : new Date(Date.UTC(y, u + 1, 0)).getUTCDate();
          this.day > d && (this.day = d);
        }
        this.apply();
        let o = f[r][0], h = f[r][2], l = this.getMaxPatternValue(o, e, h);
        if (o === "day") {
          let y = this.getLastDayOfMonth(this.year, this.month);
          this[o] = Math.min(l, y);
        } else this[o] = l;
        if (this.apply(), r === 0) {
          let y = f[1][2], u = this.getMaxPatternValue("day", e, y), d = this.getLastDayOfMonth(this.year, this.month), c = Math.min(u, d);
          c !== this.day && (this.day = c, this.hour = this.getMaxPatternValue("hour", e, f[2][2]), this.minute = this.getMaxPatternValue("minute", e, f[3][2]), this.second = this.getMaxPatternValue("second", e, f[4][2]));
        }
        if (r === 0 && !e.starYear) {
          for (; this.year >= 0 && this.year < e.year.length && e.year[this.year] === 0; ) this.year--;
          if (this.year < 0) return null;
        }
        return this.recurseBackward(e, t, 0, n + 1);
      } else if (this.apply()) return this.recurseBackward(e, t, r - 1, n + 1);
    }
    return r += 1, r >= f.length ? this : this.year < 0 ? null : this.recurseBackward(e, t, r, n + 1);
  }
  getMaxPatternValue(e, t, r) {
    if (e === "day" && t.lastDayOfMonth) return this.getLastDayOfMonth(this.year, this.month);
    if (e === "day" && !t.starDOW) return this.getLastDayOfMonth(this.year, this.month);
    for (let n = t[e].length - 1; n >= 0; n--) if (t[e][n]) return n - r;
    return t[e].length - 1 - r;
  }
  findPrevious(e, t, r, n) {
    return this._findMatch(e, t, r, n, -1);
  }
  getDate(e) {
    return e || this.tz === void 0 ? new Date(this.year, this.month, this.day, this.hour, this.minute, this.second, this.ms) : typeof this.tz == "number" ? new Date(Date.UTC(this.year, this.month, this.day, this.hour, this.minute - this.tz, this.second, this.ms)) : k(b(this.year, this.month + 1, this.day, this.hour, this.minute, this.second, this.tz), false);
  }
  getTime() {
    return this.getDate(false).getTime();
  }
  match(e, t) {
    if (!e.starYear && (this.year < 0 || this.year >= e.year.length || e.year[this.year] === 0)) return false;
    for (let r = 0; r < f.length; r++) {
      let n = f[r][0], i = f[r][2], a = this[n];
      if (a + i < 0 || a + i >= e[n].length) return false;
      let o = e[n][a + i];
      if (n === "day") {
        if (!o) {
          for (let h = 0; h < e.nearestWeekdays.length; h++) if (e.nearestWeekdays[h]) {
            let l = this.getNearestWeekday(this.year, this.month, h - i);
            if (l !== -1 && l === a) {
              o = 1;
              break;
            }
          }
        }
        if (e.lastWeekday) {
          let h = this.getLastWeekday(this.year, this.month);
          a === h && (o = 1);
        }
        if (e.lastDayOfMonth) {
          let h = this.getLastDayOfMonth(this.year, this.month);
          a === h && (o = 1);
        }
        if (!e.starDOW) {
          let h = new Date(Date.UTC(this.year, this.month, 1, 0, 0, 0, 0)).getUTCDay(), l = e.dayOfWeek[(h + (a - 1)) % 7];
          l && l & 63 && (l = this.isNthWeekdayOfMonth(this.year, this.month, a, l) ? 1 : 0), e.useAndLogic ? o = o && l : !t.domAndDow && !e.starDOM ? o = o || l : o = o && l;
        }
      }
      if (!o) return false;
    }
    return true;
  }
};
function R(s2) {
  if (s2 === void 0 && (s2 = {}), delete s2.name, s2.legacyMode !== void 0 && s2.domAndDow === void 0 ? s2.domAndDow = !s2.legacyMode : s2.domAndDow === void 0 && (s2.domAndDow = false), s2.legacyMode = !s2.domAndDow, s2.paused = s2.paused === void 0 ? false : s2.paused, s2.maxRuns = s2.maxRuns === void 0 ? 1 / 0 : s2.maxRuns, s2.catch = s2.catch === void 0 ? false : s2.catch, s2.interval = s2.interval === void 0 ? 0 : parseInt(s2.interval.toString(), 10), s2.utcOffset = s2.utcOffset === void 0 ? void 0 : parseInt(s2.utcOffset.toString(), 10), s2.dayOffset = s2.dayOffset === void 0 ? 0 : parseInt(s2.dayOffset.toString(), 10), s2.unref = s2.unref === void 0 ? false : s2.unref, s2.mode = s2.mode === void 0 ? "auto" : s2.mode, s2.alternativeWeekdays = s2.alternativeWeekdays === void 0 ? false : s2.alternativeWeekdays, s2.sloppyRanges = s2.sloppyRanges === void 0 ? false : s2.sloppyRanges, !["auto", "5-part", "6-part", "7-part", "5-or-6-parts", "6-or-7-parts"].includes(s2.mode)) throw new Error("CronOptions: mode must be one of 'auto', '5-part', '6-part', '7-part', '5-or-6-parts', or '6-or-7-parts'.");
  if (s2.startAt && (s2.startAt = new m(s2.startAt, s2.timezone)), s2.stopAt && (s2.stopAt = new m(s2.stopAt, s2.timezone)), s2.interval !== null) {
    if (isNaN(s2.interval)) throw new Error("CronOptions: Supplied value for interval is not a number");
    if (s2.interval < 0) throw new Error("CronOptions: Supplied value for interval can not be negative");
  }
  if (s2.utcOffset !== void 0) {
    if (isNaN(s2.utcOffset)) throw new Error("CronOptions: Invalid value passed for utcOffset, should be number representing minutes offset from UTC.");
    if (s2.utcOffset < -870 || s2.utcOffset > 870) throw new Error("CronOptions: utcOffset out of bounds.");
    if (s2.utcOffset !== void 0 && s2.timezone) throw new Error("CronOptions: Combining 'utcOffset' with 'timezone' is not allowed.");
  }
  if (s2.unref !== true && s2.unref !== false) throw new Error("CronOptions: Unref should be either true, false or undefined(false).");
  if (s2.dayOffset !== void 0 && s2.dayOffset !== 0 && isNaN(s2.dayOffset)) throw new Error("CronOptions: Invalid value passed for dayOffset, should be a number representing days to offset.");
  return s2;
}
function p(s2) {
  return Object.prototype.toString.call(s2) === "[object Function]" || typeof s2 == "function" || s2 instanceof Function;
}
function _(s2) {
  return p(s2);
}
function x(s2) {
  typeof Deno < "u" && typeof Deno.unrefTimer < "u" ? Deno.unrefTimer(s2) : s2 && typeof s2.unref < "u" && s2.unref();
}
var W = 30 * 1e3;
var w = [];
var E = class {
  name;
  options;
  _states;
  fn;
  getTz() {
    return this.options.timezone || this.options.utcOffset;
  }
  applyDayOffset(e) {
    if (this.options.dayOffset !== void 0 && this.options.dayOffset !== 0) {
      let t = this.options.dayOffset * 24 * 60 * 60 * 1e3;
      return new Date(e.getTime() + t);
    }
    return e;
  }
  constructor(e, t, r) {
    let n, i;
    if (p(t)) i = t;
    else if (typeof t == "object") n = t;
    else if (t !== void 0) throw new Error("Cron: Invalid argument passed for optionsIn. Should be one of function, or object (options).");
    if (p(r)) i = r;
    else if (typeof r == "object") n = r;
    else if (r !== void 0) throw new Error("Cron: Invalid argument passed for funcIn. Should be one of function, or object (options).");
    if (this.name = n?.name, this.options = R(n), this._states = { kill: false, blocking: false, previousRun: void 0, currentRun: void 0, once: void 0, currentTimeout: void 0, maxRuns: n ? n.maxRuns : void 0, paused: n ? n.paused : false, pattern: new C("* * * * *", void 0, { mode: "auto" }) }, e && (e instanceof Date || typeof e == "string" && e.indexOf(":") > 0) ? this._states.once = new m(e, this.getTz()) : this._states.pattern = new C(e, this.options.timezone, { mode: this.options.mode, alternativeWeekdays: this.options.alternativeWeekdays, sloppyRanges: this.options.sloppyRanges }), this.name) {
      if (w.find((o) => o.name === this.name)) throw new Error("Cron: Tried to initialize new named job '" + this.name + "', but name already taken.");
      w.push(this);
    }
    return i !== void 0 && _(i) && (this.fn = i, this.schedule()), this;
  }
  nextRun(e) {
    let t = this._next(e);
    return t ? this.applyDayOffset(t.getDate(false)) : null;
  }
  nextRuns(e, t) {
    this._states.maxRuns !== void 0 && e > this._states.maxRuns && (e = this._states.maxRuns);
    let r = t || this._states.currentRun || void 0;
    return this._enumerateRuns(e, r, "next");
  }
  previousRuns(e, t) {
    return this._enumerateRuns(e, t || void 0, "previous");
  }
  _enumerateRuns(e, t, r) {
    let n = [], i = t ? new m(t, this.getTz()) : null, a = r === "next" ? this._next : this._previous;
    for (; e--; ) {
      let o = a.call(this, i);
      if (!o) break;
      let h = o.getDate(false);
      n.push(this.applyDayOffset(h)), i = o;
    }
    return n;
  }
  match(e) {
    if (this._states.once) {
      let r = new m(e, this.getTz());
      r.ms = 0;
      let n = new m(this._states.once, this.getTz());
      return n.ms = 0, r.getTime() === n.getTime();
    }
    let t = new m(e, this.getTz());
    return t.ms = 0, t.match(this._states.pattern, this.options);
  }
  getPattern() {
    if (!this._states.once) return this._states.pattern ? this._states.pattern.pattern : void 0;
  }
  getOnce() {
    return this._states.once ? this._states.once.getDate() : null;
  }
  isRunning() {
    let e = this.nextRun(this._states.currentRun), t = !this._states.paused, r = this.fn !== void 0, n = !this._states.kill;
    return t && r && n && e !== null;
  }
  isStopped() {
    return this._states.kill;
  }
  isBusy() {
    return this._states.blocking;
  }
  currentRun() {
    return this._states.currentRun ? this._states.currentRun.getDate() : null;
  }
  previousRun() {
    return this._states.previousRun ? this._states.previousRun.getDate() : null;
  }
  msToNext(e) {
    let t = this._next(e);
    return t ? e instanceof m || e instanceof Date ? t.getTime() - e.getTime() : t.getTime() - new m(e).getTime() : null;
  }
  stop() {
    this._states.kill = true, this._states.currentTimeout && clearTimeout(this._states.currentTimeout);
    let e = w.indexOf(this);
    e >= 0 && w.splice(e, 1);
  }
  pause() {
    return this._states.paused = true, !this._states.kill;
  }
  resume() {
    return this._states.paused = false, !this._states.kill;
  }
  schedule(e) {
    if (e && this.fn) throw new Error("Cron: It is not allowed to schedule two functions using the same Croner instance.");
    e && (this.fn = e);
    let t = this.msToNext(), r = this.nextRun(this._states.currentRun);
    return t == null || isNaN(t) || r === null ? this : (t > W && (t = W), this._states.currentTimeout = setTimeout(() => this._checkTrigger(r), t), this._states.currentTimeout && this.options.unref && x(this._states.currentTimeout), this);
  }
  async _trigger(e) {
    this._states.blocking = true, this._states.currentRun = new m(void 0, this.getTz());
    try {
      if (this.options.catch) try {
        this.fn !== void 0 && await this.fn(this, this.options.context);
      } catch (t) {
        if (p(this.options.catch)) try {
          this.options.catch(t, this);
        } catch {
        }
      }
      else this.fn !== void 0 && await this.fn(this, this.options.context);
    } finally {
      this._states.previousRun = new m(e, this.getTz()), this._states.blocking = false;
    }
  }
  async trigger() {
    await this._trigger();
  }
  runsLeft() {
    return this._states.maxRuns;
  }
  _checkTrigger(e) {
    let t = /* @__PURE__ */ new Date(), r = !this._states.paused && t.getTime() >= e.getTime(), n = this._states.blocking && this.options.protect;
    r && !n ? (this._states.maxRuns !== void 0 && this._states.maxRuns--, this._trigger()) : r && n && p(this.options.protect) && setTimeout(() => this.options.protect(this), 0), this.schedule();
  }
  _next(e) {
    let t = !!(e || this._states.currentRun), r = false;
    !e && this.options.startAt && this.options.interval && ([e, t] = this._calculatePreviousRun(e, t), r = !e), e = new m(e, this.getTz()), this.options.startAt && e && e.getTime() < this.options.startAt.getTime() && (e = this.options.startAt);
    let n = this._states.once || new m(e, this.getTz());
    return !r && n !== this._states.once && (n = n.increment(this._states.pattern, this.options, t)), this._states.once && this._states.once.getTime() <= e.getTime() || n === null || this._states.maxRuns !== void 0 && this._states.maxRuns <= 0 || this._states.kill || this.options.stopAt && n.getTime() >= this.options.stopAt.getTime() ? null : n;
  }
  _previous(e) {
    let t = new m(e, this.getTz());
    this.options.stopAt && t.getTime() > this.options.stopAt.getTime() && (t = this.options.stopAt);
    let r = new m(t, this.getTz());
    return this._states.once ? this._states.once.getTime() < t.getTime() ? this._states.once : null : (r = r.decrement(this._states.pattern, this.options), r === null || this.options.startAt && r.getTime() < this.options.startAt.getTime() ? null : r);
  }
  _calculatePreviousRun(e, t) {
    let r = new m(void 0, this.getTz()), n = e;
    if (this.options.startAt.getTime() <= r.getTime()) {
      n = this.options.startAt;
      let i = n.getTime() + this.options.interval * 1e3;
      for (; i <= r.getTime(); ) n = new m(n, this.getTz()).increment(this._states.pattern, this.options, true), i = n.getTime() + this.options.interval * 1e3;
      t = true;
    }
    return n === null && (n = void 0), [n, t];
  }
};

// src/shared/describe.js
var WEEKDAY = {
  zh: ["", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u65E5"],
  en: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
};
var pick = (lang) => lang === "en" ? "en" : "zh";
function formatLocal(date, timeZone, { weekday = true, seconds = false, lang = "zh" } = {}) {
  if (!date) return "\u2014";
  const d = new Date(date);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23"
  }).formatToParts(d).map((p2) => [p2.type, p2.value]));
  const iso = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday];
  const day = pick(lang) === "en" ? ` ${WEEKDAY.en[iso]}` : ` \u5468${WEEKDAY.zh[iso]}`;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}${seconds ? ":" + parts.second : ""}${weekday ? day : ""}`;
}
function weekdaysText(days, lang) {
  const key2 = days.join(",");
  if (lang === "en") {
    if (key2 === "1,2,3,4,5") return "Weekdays";
    if (key2 === "6,7") return "Weekends";
    if (key2 === "1,2,3,4,5,6,7") return "Every day";
    return days.map((d) => WEEKDAY.en[d]).join(", ");
  }
  if (key2 === "1,2,3,4,5") return "\u5DE5\u4F5C\u65E5";
  if (key2 === "6,7") return "\u5468\u672B";
  if (key2 === "1,2,3,4,5,6,7") return "\u6BCF\u5929";
  return "\u6BCF\u5468" + days.map((d) => WEEKDAY.zh[d]).join("\u3001");
}
function everyText(minutes, lang) {
  const [n, unit] = minutes % 1440 === 0 ? [minutes / 1440, "day"] : minutes % 60 === 0 ? [minutes / 60, "hour"] : [minutes, "minute"];
  if (lang === "en") return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
  return `\u6BCF ${n} ${{ day: "\u5929", hour: "\u5C0F\u65F6", minute: "\u5206\u949F" }[unit]}`;
}
function describeRule(rule, viewerZone, lang = "zh") {
  lang = pick(lang);
  const en = lang === "en";
  const zone = viewerZone && viewerZone !== rule.timeZone ? en ? ` (${rule.timeZone})` : `\uFF08${rule.timeZone}\uFF09` : "";
  switch (rule.type) {
    case "once":
      return `${formatLocal(rule.at, rule.timeZone, { lang })}${en ? " (once)" : "\uFF08\u4E00\u6B21\uFF09"}${zone}`;
    case "every":
      return everyText(rule.everyMinutes, lang);
    case "daily":
      return `${en ? "Every day" : "\u6BCF\u5929"} ${rule.time}${zone}`;
    case "weekly":
      return `${weekdaysText(rule.weekdays, lang)} ${rule.time}${zone}`;
    case "monthly":
      return en ? `Monthly on day ${rule.days.join(", ")} at ${rule.time}${zone}` : `\u6BCF\u6708 ${rule.days.join("\u3001")} \u65E5 ${rule.time}${zone}`;
    case "cron":
      return `cron\u300C${rule.cron}\u300D${zone}`;
    default:
      return en ? "Unknown rule" : "\u672A\u77E5\u89C4\u5219";
  }
}

// src/shared/rules.js
var MIN_INTERVAL_MS = 6e4;
var RULE_TYPES = ["once", "every", "daily", "weekly", "monthly", "cron"];
var RuleError = class extends Error {
  constructor(message, en) {
    super(message);
    this.en = en ?? message;
  }
};
function isTimeZone(zone) {
  if (typeof zone !== "string" || zone === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
var hostTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) throw new RuleError(`time \u5FC5\u987B\u662F 24 \u5C0F\u65F6\u5236 HH:MM\uFF0C\u6536\u5230\uFF1A${value}`, `Time must be 24-hour HH:MM, got: ${value}`);
  const [h, m2] = [Number(match[1]), Number(match[2])];
  if (h > 23 || m2 > 59) throw new RuleError(`\u65E0\u6548\u7684\u65F6\u95F4\uFF1A${value}`, `Invalid time: ${value}`);
  return `${String(h).padStart(2, "0")}:${String(m2).padStart(2, "0")}`;
}
function intList(value, min, max, field) {
  const list = (Array.isArray(value) ? value : [value]).map(Number);
  if (list.length === 0 || list.some((n) => !Number.isInteger(n) || n < min || n > max)) throw new RuleError(`${field} \u5FC5\u987B\u662F ${min}\u2013${max} \u7684\u6574\u6570\u5217\u8868`, `${field} must be whole numbers from ${min} to ${max}`);
  return [...new Set(list)].sort((a, b2) => a - b2);
}
function checkCron(expression, timeZone) {
  const text2 = String(expression ?? "").trim().replace(/\s+/g, " ");
  if (text2.split(" ").length !== 5) throw new RuleError('cron \u5FC5\u987B\u662F\u6807\u51C6\u7684 5 \u6BB5\u683C\u5F0F\uFF1A\u5206 \u65F6 \u65E5 \u6708 \u5468\uFF0C\u4F8B\u5982 "0 9 * * 1-5"', 'Cron must have five fields: minute hour day month weekday, e.g. "0 9 * * 1-5"');
  try {
    new E(text2, { timezone: timeZone, paused: true });
  } catch (error) {
    throw new RuleError(`\u65E0\u6548\u7684 cron \u8868\u8FBE\u5F0F\uFF1A${error.message}`, `Invalid cron expression: ${error.message}`);
  }
  return text2;
}
function parseLocalDateTime(value, timeZone) {
  const text2 = String(value ?? "").trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(text2)) {
    const date = new Date(text2);
    if (Number.isNaN(date.getTime())) throw new RuleError(`\u65E0\u6548\u7684\u65F6\u95F4\uFF1A${value}`, `Invalid time: ${value}`);
    return date;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text2);
  if (!match) throw new RuleError(`at \u5FC5\u987B\u662F "YYYY-MM-DD HH:MM"\uFF08\u6309 time_zone \u89E3\u91CA\uFF09\u6216\u5E26\u65F6\u533A\u504F\u79FB\u7684 ISO \u65F6\u95F4\uFF0C\u6536\u5230\uFF1A${value}`, `Pick a date and time (got: ${value})`);
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4].padStart(2, "0")}:${match[5]}:${match[6] ?? "00"}`;
  try {
    const run = new E(iso, { timezone: timeZone, paused: true }).nextRun(/* @__PURE__ */ new Date(0));
    if (!run) throw new Error("empty");
    return run;
  } catch {
    throw new RuleError(`\u65E0\u6548\u7684\u65F6\u95F4\uFF1A${value}`, `Invalid time: ${value}`);
  }
}
function normalizeRule(input, { now = /* @__PURE__ */ new Date(), defaultTimeZone = hostTimeZone() } = {}) {
  if (!input || typeof input !== "object") throw new RuleError("\u7F3A\u5C11 schedule", "Missing schedule");
  const type = input.type;
  if (!RULE_TYPES.includes(type)) throw new RuleError(`schedule.type \u5FC5\u987B\u662F ${RULE_TYPES.join(" / ")}`, `Repeat must be one of ${RULE_TYPES.join(" / ")}`);
  const timeZone = input.time_zone ?? input.timeZone ?? defaultTimeZone;
  if (!isTimeZone(timeZone)) throw new RuleError(`\u65E0\u6548\u7684 IANA \u65F6\u533A\uFF1A${timeZone}`, `Unknown time zone: ${timeZone}`);
  switch (type) {
    case "once": {
      const at = parseLocalDateTime(input.at, timeZone);
      if (at.getTime() <= now.getTime()) throw new RuleError(`\u65F6\u95F4 ${input.at} \u5DF2\u7ECF\u8FC7\u53BB\u4E86`, `${input.at} is in the past`);
      return { type, timeZone, at: at.toISOString() };
    }
    case "every": {
      const minutes = Number(input.every_minutes ?? input.everyMinutes);
      if (!Number.isFinite(minutes) || minutes * 6e4 < MIN_INTERVAL_MS || minutes > 60 * 24 * 366) throw new RuleError("every_minutes \u81F3\u5C11\u4E3A 1", "The interval must be at least 1 minute");
      const anchor = input.anchor ? new Date(input.anchor) : now;
      return { type, timeZone, everyMinutes: Math.round(minutes * 100) / 100, anchor: anchor.toISOString() };
    }
    case "daily":
      return { type, timeZone, time: parseTime(input.time) };
    case "weekly":
      return { type, timeZone, time: parseTime(input.time), weekdays: intList(input.weekdays, 1, 7, "weekdays") };
    case "monthly":
      return { type, timeZone, time: parseTime(input.time), days: intList(input.days, 1, 31, "days") };
    case "cron": {
      const cron = checkCron(input.cron, timeZone);
      const runs = new E(cron, { timezone: timeZone, paused: true }).nextRuns(3, now);
      if (runs.length === 0) throw new RuleError("\u8FD9\u4E2A cron \u8868\u8FBE\u5F0F\u4EE5\u540E\u4E0D\u4F1A\u518D\u89E6\u53D1", "This cron expression never fires again");
      return { type, timeZone, cron };
    }
    default:
      throw new RuleError("\u672A\u77E5\u7684 schedule.type", "Unknown repeat type");
  }
}
function cronOf(rule) {
  if (rule.type === "cron") return rule.cron;
  const [h, m2] = rule.time.split(":").map(Number);
  if (rule.type === "daily") return `${m2} ${h} * * *`;
  if (rule.type === "weekly") return `${m2} ${h} * * ${rule.weekdays.map((d) => d % 7).join(",")}`;
  if (rule.type === "monthly") return `${m2} ${h} ${rule.days.join(",")} * *`;
  return void 0;
}
function nextOccurrence(rule, after = /* @__PURE__ */ new Date()) {
  if (rule.type === "once") {
    const at = new Date(rule.at);
    return at > after ? at : null;
  }
  if (rule.type === "every") {
    const interval = rule.everyMinutes * 6e4;
    const anchor = new Date(rule.anchor).getTime();
    const steps = Math.max(1, Math.floor((after.getTime() - anchor) / interval) + 1);
    return new Date(anchor + steps * interval);
  }
  return new E(cronOf(rule), { timezone: rule.timeZone, paused: true }).nextRun(after) ?? null;
}
function nextOccurrences(rule, count, after = /* @__PURE__ */ new Date()) {
  const list = [];
  let cursor = after;
  for (let i = 0; i < count; i++) {
    const next = nextOccurrence(rule, cursor);
    if (!next) break;
    list.push(next);
    cursor = next;
  }
  return list;
}

// src/host/store.js
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
var MAX_RUNS = 50;
var TaskError = class extends Error {
  constructor(message, status = 400, en) {
    super(message);
    this.status = status;
    this.en = en ?? message;
  }
};
var defaultDataDir = () => process.env.DSH_SCHEDULER_DIR ?? join(homedir(), ".dsh", "plugin-data", "scheduler");
var newId = (prefix) => `${prefix}-${randomBytes(5).toString("hex")}`;
function createStore({ dir = defaultDataDir() } = {}) {
  const file = join(dir, "tasks.json");
  let cache;
  let queue = Promise.resolve();
  async function load() {
    if (cache !== void 0) return cache;
    try {
      const parsed = JSON.parse(await readFile(file, "utf8"));
      cache = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    } catch (error) {
      if (error?.code !== "ENOENT") throw new TaskError(`\u65E0\u6CD5\u8BFB\u53D6 ${file}\uFF1A${error.message}`, 500, `Cannot read ${file}: ${error.message}`);
      cache = [];
    }
    return cache;
  }
  async function persist(list) {
    await mkdir(dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${randomBytes(3).toString("hex")}.tmp`;
    await writeFile(temp, JSON.stringify({ version: 1, tasks: list }, null, 2));
    await rename(temp, file);
    cache = list;
  }
  const exclusive = (fn) => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {
    });
    return run;
  };
  return {
    file,
    list: async () => structuredClone(await load()),
    get: async (id) => structuredClone((await load()).find((t) => t.id === id)),
    insert: (task) => exclusive(async () => {
      const list = await load();
      await persist([...list, task]);
      return structuredClone(task);
    }),
    /** Read-modify-write one task; `mutate` returns the replacement (or undefined to leave it). */
    update: (id, mutate) => exclusive(async () => {
      const list = await load();
      const current = list.find((t) => t.id === id);
      if (current === void 0) throw new TaskError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404, "Task not found");
      const next = await mutate(structuredClone(current));
      if (next === void 0) return structuredClone(current);
      if (next.runs?.length > MAX_RUNS) next.runs = next.runs.slice(-MAX_RUNS);
      await persist(list.map((t) => t.id === id ? next : t));
      return structuredClone(next);
    }),
    remove: (id) => exclusive(async () => {
      const list = await load();
      if (!list.some((t) => t.id === id)) return false;
      await persist(list.filter((t) => t.id !== id));
      return true;
    })
  };
}

// src/host/engine.js
var LATE_GRACE_MS = 15 * 60 * 1e3;
var MAX_TIMER_MS = 60 * 60 * 1e3;
var SUMMARY_CHARS = 600;
function composePrompt(task, { now, scheduledFor, trigger, lastSuccessAt, connectorsText }) {
  const zone = task.schedule.timeZone;
  const lines = [
    `\u3010\u5B9A\u65F6\u4EFB\u52A1\u3011${task.title}`,
    `\u672C\u6B21\u8FD0\u884C\uFF1A${formatLocal(now, zone)}\uFF08${zone}\uFF09${trigger === "manual" ? "\xB7 \u624B\u52A8\u89E6\u53D1" : scheduledFor ? `\xB7 \u8BA1\u5212\u65F6\u95F4 ${formatLocal(scheduledFor, zone, { weekday: false })}` : ""}`,
    `\u4E0A\u6B21\u6210\u529F\u8FD0\u884C\uFF1A${lastSuccessAt ? `${formatLocal(lastSuccessAt, zone)}\uFF08ISO: ${new Date(lastSuccessAt).toISOString()}\uFF09\u2014\u2014\u53EA\u9700\u5904\u7406\u8FD9\u4E4B\u540E\u7684\u65B0\u5185\u5BB9` : "\u65E0\uFF08\u8FD9\u662F\u7B2C\u4E00\u6B21\u8FD0\u884C\uFF09"}`
  ];
  if (connectorsText) lines.push(connectorsText);
  lines.push(
    "\u8FD9\u662F\u4E00\u6B21\u65E0\u4EBA\u503C\u5B88\u7684\u81EA\u52A8\u8FD0\u884C\uFF1A\u4E0D\u8981\u5411\u7528\u6237\u63D0\u95EE\u6216\u7B49\u5F85\u786E\u8BA4\uFF0C\u76F4\u63A5\u5B8C\u6210\u4EFB\u52A1\uFF1B\u4FE1\u606F\u4E0D\u8DB3\u65F6\u6309\u6700\u5408\u7406\u7684\u65B9\u5F0F\u5904\u7406\uFF0C\u5E76\u5728\u7ED3\u679C\u91CC\u8BF4\u660E\u4F60\u7684\u5047\u8BBE\u3002\u6700\u540E\u7528\u7B80\u6D01\u7684\u4E2D\u6587\u7ED9\u51FA\u7ED3\u8BBA\u3002",
    "",
    "\u4EFB\u52A1\uFF1A",
    task.prompt
  );
  return lines.join("\n");
}
function lastAssistantText(session) {
  try {
    const messages = session?.deriveMessages?.() ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role !== "assistant") continue;
      const text2 = (message.content ?? []).filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
      if (text2) return text2.length > SUMMARY_CHARS ? `${text2.slice(0, SUMMARY_CHARS)}\u2026` : text2;
    }
  } catch {
  }
  return void 0;
}
function createEngine({ store, startSession, connectorsText = () => void 0, now = () => /* @__PURE__ */ new Date(), log = () => {
}, onChange = () => {
}, lateGraceMs = LATE_GRACE_MS, timers = { set: setTimeout, clear: clearTimeout }, chooseModel = async (pinned) => ({ selection: pinned }) }) {
  let timer;
  let stopped = false;
  let ticking = Promise.resolve();
  const bySession = /* @__PURE__ */ new Map();
  function arm(tasks) {
    timers.clear(timer);
    timer = void 0;
    if (stopped) return;
    const due = tasks.filter((t) => t.enabled && t.nextRunAt).map((t) => new Date(t.nextRunAt).getTime());
    if (due.length === 0) return;
    const delay = Math.min(MAX_TIMER_MS, Math.max(0, Math.min(...due) - now().getTime()));
    timer = timers.set(() => {
      tick().catch((error) => log(`\u5B9A\u65F6\u4EFB\u52A1\u8C03\u5EA6\u51FA\u9519\uFF1A${error.message}`));
    }, delay);
    timer?.unref?.();
  }
  async function reschedule() {
    arm(await store.list());
    onChange();
  }
  async function record(taskId, runId, fields) {
    await store.update(taskId, (task) => {
      const run = task.runs.find((r) => r.id === runId);
      if (!run) return void 0;
      Object.assign(run, fields);
      if (fields.status && fields.status !== "running") task.lastRun = { ...run };
      return task;
    }).catch((error) => log(`\u66F4\u65B0\u8FD0\u884C\u8BB0\u5F55\u5931\u8D25\uFF1A${error.message}`));
    onChange();
  }
  async function fire(taskId, trigger) {
    const at = now();
    let run;
    let snapshot;
    await store.update(taskId, (task) => {
      const scheduledFor = trigger === "schedule" ? task.nextRunAt : void 0;
      if (trigger === "schedule") {
        const next = nextOccurrence(task.schedule, at);
        task.nextRunAt = next ? next.toISOString() : null;
        if (!next) task.enabled = false;
      }
      run = { id: newId("r"), trigger, scheduledFor, startedAt: at.toISOString(), status: "starting" };
      const late = scheduledFor ? at.getTime() - new Date(scheduledFor).getTime() : 0;
      if (trigger === "schedule" && late > lateGraceMs && task.misfire === "skip") {
        Object.assign(run, { status: "missed", finishedAt: at.toISOString(), error: `\u9519\u8FC7\u4E86\u8BA1\u5212\u65F6\u95F4\uFF08\u665A\u4E86 ${Math.round(late / 6e4)} \u5206\u949F\uFF09\uFF0C\u6309\u8BBE\u7F6E\u8DF3\u8FC7`, code: "missed", minutes: Math.round(late / 6e4) });
      } else if (task.runs.some((r) => r.status === "running" || r.status === "starting")) {
        Object.assign(run, { status: "skipped", finishedAt: at.toISOString(), error: "\u4E0A\u4E00\u6B21\u8FD0\u884C\u8FD8\u6CA1\u6709\u7ED3\u675F\uFF0C\u8DF3\u8FC7\u672C\u6B21", code: "overlap" });
      }
      if (run.status !== "starting") task.lastRun = { ...run };
      task.runs.push(run);
      if (task.runs.length > MAX_RUNS) task.runs = task.runs.slice(-MAX_RUNS);
      snapshot = task;
      return task;
    });
    if (run.status !== "starting") {
      onChange();
      return run;
    }
    const lastSuccess = [...snapshot.runs].reverse().find((r) => r.status === "completed");
    const text2 = composePrompt(snapshot, {
      now: at,
      scheduledFor: run.scheduledFor,
      trigger,
      lastSuccessAt: lastSuccess?.startedAt,
      connectorsText: await connectorsText(snapshot)
    });
    try {
      const { selection, fallback } = await chooseModel(snapshot.model);
      const { sessionId } = await startSession({
        workspace: snapshot.workspace,
        title: `\u23F0 ${snapshot.title} \xB7 ${formatLocal(at, snapshot.schedule.timeZone, { weekday: false }).slice(5)}`,
        text: text2,
        model: selection,
        agentPreset: snapshot.agentPreset,
        permissionPreset: snapshot.permissionPreset
      });
      bySession.set(sessionId, { taskId, runId: run.id });
      const used = { ...selection ? { model: selection } : {}, ...fallback ? { fallback } : {} };
      if (fallback) log(`\u5B9A\u65F6\u4EFB\u52A1 ${snapshot.title}\uFF1A${fallback.from?.model ?? "\u9ED8\u8BA4\u6A21\u578B"} \u4E0D\u53EF\u7528\uFF0C\u672C\u6B21\u6539\u7528 ${fallback.to.model}`);
      run = { ...run, status: "running", sessionId, ...used };
      await record(taskId, run.id, { status: "running", sessionId, ...used });
    } catch (error) {
      run = { ...run, status: "failed", error: `\u65E0\u6CD5\u542F\u52A8\u4F1A\u8BDD\uFF1A${error.message}`, code: "start_failed", detail: error.message };
      await record(taskId, run.id, { status: "failed", finishedAt: now().toISOString(), error: run.error, code: run.code, detail: run.detail });
    }
    return run;
  }
  async function tick() {
    ticking = ticking.then(async () => {
      const at = now().getTime();
      const due = (await store.list()).filter((t) => t.enabled && t.nextRunAt && new Date(t.nextRunAt).getTime() <= at);
      for (const task of due) {
        await fire(task.id, "schedule").catch((error) => log(`\u5B9A\u65F6\u4EFB\u52A1 ${task.title} \u8FD0\u884C\u5931\u8D25\uFF1A${error.message}`));
      }
      await reschedule();
    });
    return ticking;
  }
  return {
    async start() {
      stopped = false;
      for (const task of await store.list()) {
        if (!task.runs?.some((r) => r.status === "running" || r.status === "starting")) continue;
        await store.update(task.id, (t) => {
          for (const r of t.runs) {
            if (r.status === "running" || r.status === "starting") Object.assign(r, { status: "interrupted", finishedAt: now().toISOString(), error: "\u8FD0\u884C\u671F\u95F4\u5E94\u7528\u88AB\u5173\u95ED\uFF0C\u7ED3\u679C\u672A\u77E5\uFF08\u53EF\u6253\u5F00\u4F1A\u8BDD\u67E5\u770B\uFF09", code: "interrupted" });
          }
          t.lastRun = { ...t.runs.at(-1) };
          return t;
        });
      }
      await tick();
    },
    stop() {
      stopped = true;
      timers.clear(timer);
    },
    reschedule,
    tick,
    runNow: async (taskId) => {
      if (!await store.get(taskId)) throw new TaskError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404, "Task not found");
      const run = await fire(taskId, "manual");
      await reschedule();
      return run;
    },
    /** Feed of `session/event`: the first `turn/end` of a run's Session settles the run. */
    onSessionEvent(session, event) {
      if (event?.type !== "turn/end") return;
      const entry = bySession.get(session?.id);
      if (!entry) return;
      bySession.delete(session.id);
      const reason = event.data?.reason ?? {};
      const status = reason.kind === "completed" || reason.kind === "max-tokens" ? "completed" : reason.kind === "aborted" || reason.kind === "interrupted" ? "aborted" : reason.kind === "error" ? "failed" : "completed";
      const error = reason.kind === "error" ? reason.error?.message ?? "\u6A21\u578B\u8BF7\u6C42\u5931\u8D25" : reason.kind === "aborted" ? "\u8FD0\u884C\u88AB\u4E2D\u6B62" : void 0;
      const code = reason.kind === "aborted" ? "aborted" : reason.kind === "error" && !reason.error?.message ? "model_failed" : void 0;
      record(entry.taskId, entry.runId, { status, finishedAt: now().toISOString(), summary: lastAssistantText(session), ...error ? { error } : {}, ...code ? { code } : {} });
    },
    get activeSessions() {
      return new Map(bySession);
    }
  };
}

// src/host/models.js
var key = (m2) => `${m2.provider}/${m2.id ?? m2.model}`;
function createModelCatalog(ctx, { ttlMs = 3e4 } = {}) {
  let cache;
  let at = 0;
  let providers = /* @__PURE__ */ new Set();
  let unlisted = /* @__PURE__ */ new Set();
  async function load() {
    const llm = ctx.get?.("llm");
    providers = /* @__PURE__ */ new Set();
    unlisted = /* @__PURE__ */ new Set();
    if (!llm) return [];
    const models = [];
    for (const provider of llm.listProviders?.() ?? []) {
      providers.add(provider.id);
      let list = [];
      try {
        list = await llm.listModels(provider.id);
      } catch {
        unlisted.add(provider.id);
        continue;
      }
      if (list.length === 0) unlisted.add(provider.id);
      for (const m2 of list) models.push({ provider: m2.provider ?? provider.id, providerName: provider.name, id: m2.id, name: m2.name || m2.id });
    }
    await Promise.allSettled(models.map(async (m2) => {
      const info = await Promise.race([llm.resolveModelInfo(m2.provider, m2.id), new Promise((_2, reject) => setTimeout(reject, 3e3))]);
      m2.efforts = (info?.reasoning?.efforts ?? []).map((e) => ({ id: String(e.id), name: e.name || String(e.id) }));
      if (info?.reasoning?.defaultEffort) m2.defaultEffort = String(info.reasoning.defaultEffort);
    }));
    return models;
  }
  const catalog = {
    async list() {
      if (!cache || Date.now() - at > ttlMs) {
        cache = await load();
        at = Date.now();
      }
      return cache;
    },
    defaultSelection() {
      try {
        return { ...ctx.agentDefaultModel.currentSelection() };
      } catch {
        return void 0;
      }
    },
    /** What the task page needs: the choices and what "follow the default" currently means. */
    async describe() {
      const models = await catalog.list();
      const def = catalog.defaultSelection();
      return { models, defaultModel: def ? { ...def, name: models.find((m2) => key(m2) === key(def))?.name ?? def.model } : void 0 };
    },
    /**
     * Turn tool/page input into a stored `{ provider, model, reasoningEffort? }`, or null for
     * "follow DSH's default". Accepts "provider/model", a bare model id, or a display name.
     */
    async resolve(input, effort) {
      if (input === void 0) return void 0;
      if (input === null || input === "" || input === "default") return null;
      const models = await catalog.list();
      const wanted = typeof input === "object" ? `${input.provider}/${input.model}` : String(input).trim();
      const lower = wanted.toLowerCase();
      const match = models.find((m2) => key(m2) === wanted) ?? models.find((m2) => m2.id === wanted) ?? models.find((m2) => m2.name.toLowerCase() === lower) ?? models.find((m2) => m2.id.toLowerCase().endsWith(lower) || m2.name.toLowerCase().includes(lower));
      if (!match) {
        const names = models.map((m2) => `${m2.name}\uFF08${m2.id}\uFF09`).join("\u3001");
        throw new TaskError(`\u627E\u4E0D\u5230\u6A21\u578B ${wanted}\u3002\u53EF\u7528\uFF1A${names || "\uFF08\u6CA1\u6709\u5DF2\u6CE8\u518C\u7684\u6A21\u578B\uFF09"}`, 400, `Unknown model ${wanted}`);
      }
      const selection = { provider: match.provider, model: match.id };
      const reasoning = effort ?? (typeof input === "object" ? input.reasoningEffort ?? input.reasoning_effort : void 0);
      if (reasoning) {
        const efforts = match.efforts ?? [];
        if (efforts.length && !efforts.some((e) => e.id === reasoning)) {
          throw new TaskError(`${match.name} \u4E0D\u652F\u6301\u601D\u8003\u5F3A\u5EA6 ${reasoning}\uFF0C\u53EF\u9009\uFF1A${efforts.map((e) => e.id).join(" / ")}`, 400, `${match.name} does not support effort ${reasoning}`);
        }
        selection.reasoningEffort = String(reasoning);
      }
      return selection;
    },
    /**
     * The model a run should start on, checked against what is registered right now:
     * the task's own model, else DSH's default, else the first model any provider offers.
     * `fallback` says what was wanted and why it was not used. Without an llm service
     * (nothing to check against) the choice passes through unchanged.
     */
    async pickRunnable(pinned) {
      if (!ctx.get?.("llm")) return { selection: pinned };
      cache = await load();
      at = Date.now();
      const usable = (sel) => Boolean(sel?.provider && sel?.model) && providers.has(sel.provider) && (unlisted.has(sel.provider) || cache.some((m2) => key(m2) === key(sel)));
      const def = catalog.defaultSelection();
      if (pinned && usable(pinned)) return { selection: pinned };
      if (usable(def)) return { selection: def, ...pinned ? { fallback: { from: pinned, to: def, reason: "pinned_missing" } } : {} };
      const first = cache[0];
      if (!first) {
        const wanted = await catalog.label(pinned ?? def);
        throw new TaskError(`\u6CA1\u6709\u53EF\u7528\u7684\u6A21\u578B${wanted ? `\uFF08${wanted} \u4E0D\u53EF\u7528\uFF09` : ""}\uFF1A\u8BF7\u5728 DSH \u8BBE\u7F6E\u91CC\u914D\u7F6E\u4E00\u4E2A\u6A21\u578B`, 500, `No model is available${wanted ? ` (${wanted} is not)` : ""}; configure one in DSH settings`);
      }
      const to = { provider: first.provider, model: first.id };
      return { selection: to, fallback: { from: pinned ?? def, to, reason: pinned ? "pinned_missing" : "default_missing" } };
    },
    /** "Claude Opus 5.5 · high", for the agent and the page. */
    async label(selection) {
      if (!selection) return void 0;
      const m2 = (await catalog.list()).find((x2) => key(x2) === key(selection));
      return `${m2?.name ?? selection.model}${selection.reasoningEffort ? ` \xB7 ${selection.reasoningEffort}` : ""}`;
    }
  };
  return catalog;
}

// src/host/tasks.js
import { stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
var FIELD_EN = { title: "Name", prompt: "Instructions" };
var text = (value, field, max, required) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (required && !trimmed) throw new TaskError(`${field} \u4E0D\u80FD\u4E3A\u7A7A`, 400, `${FIELD_EN[field] ?? field} is required`);
  if (trimmed.length > max) throw new TaskError(`${field} \u6700\u957F ${max} \u4E2A\u5B57\u7B26`, 400, `${FIELD_EN[field] ?? field} can be at most ${max} characters`);
  return trimmed;
};
async function checkWorkspace(path) {
  if (typeof path !== "string" || !isAbsolute(path)) throw new TaskError("workspace \u5FC5\u987B\u662F\u7EDD\u5BF9\u8DEF\u5F84", 400, "The workspace must be an absolute path");
  const info = await stat(path).catch(() => void 0);
  if (!info?.isDirectory()) throw new TaskError(`\u5DE5\u4F5C\u533A\u76EE\u5F55\u4E0D\u5B58\u5728\uFF1A${path}`, 400, `Workspace folder does not exist: ${path}`);
  return path;
}
var modelOf = (m2) => m2?.provider && m2?.model ? { provider: String(m2.provider), model: String(m2.model), ...m2.reasoningEffort ? { reasoningEffort: String(m2.reasoningEffort) } : {} } : void 0;
var wrapRule = (fn) => {
  try {
    return fn();
  } catch (error) {
    if (error instanceof RuleError) throw new TaskError(error.message, 400, error.en);
    throw error;
  }
};
function viewTask(task, { viewerZone, preview = 0, now = /* @__PURE__ */ new Date() } = {}) {
  const zone = task.schedule.timeZone;
  return {
    id: task.id,
    title: task.title,
    prompt: task.prompt,
    enabled: task.enabled,
    schedule: task.schedule,
    scheduleText: describeRule(task.schedule, viewerZone),
    nextRunAt: task.nextRunAt,
    nextRunText: task.enabled && task.nextRunAt ? `${formatLocal(task.nextRunAt, zone)}\uFF08${zone}\uFF09` : task.enabled ? "\u4E0D\u4F1A\u518D\u8FD0\u884C" : "\u5DF2\u6682\u505C",
    ...preview > 0 && task.enabled ? (() => {
      const upcoming = nextOccurrences(task.schedule, preview, now);
      return { upcoming: upcoming.map((d) => formatLocal(d, zone)), upcomingAt: upcoming.map((d) => d.toISOString()) };
    })() : {},
    workspace: task.workspace,
    connectors: task.connectors ?? [],
    misfire: task.misfire ?? "run_once",
    model: task.model,
    permissionPreset: task.permissionPreset,
    lastRun: task.lastRun,
    runCount: task.runs?.length ?? 0,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    createdFrom: task.createdFrom
  };
}
function createTasks({ store, engine, now = () => /* @__PURE__ */ new Date(), defaultTimeZone }) {
  return {
    async list() {
      return store.list();
    },
    async create(input, { createdFrom } = {}) {
      const at = now();
      const schedule = wrapRule(() => normalizeRule(input.schedule, { now: at, defaultTimeZone: input.defaultTimeZone ?? defaultTimeZone() }));
      const next = nextOccurrence(schedule, at);
      const task = {
        id: newId("t"),
        title: text(input.title, "title", 80, true),
        prompt: text(input.prompt, "prompt", 2e4, true),
        schedule,
        enabled: input.enabled !== false,
        workspace: await checkWorkspace(input.workspace),
        connectors: Array.isArray(input.connectors) ? input.connectors.map(String).filter(Boolean).slice(0, 20) : [],
        misfire: input.misfire === "skip" ? "skip" : "run_once",
        ...modelOf(input.model) ? { model: modelOf(input.model) } : {},
        ...input.permissionPreset ? { permissionPreset: String(input.permissionPreset) } : {},
        ...input.agentPreset ? { agentPreset: String(input.agentPreset) } : {},
        nextRunAt: next ? next.toISOString() : null,
        createdAt: at.toISOString(),
        updatedAt: at.toISOString(),
        ...createdFrom ? { createdFrom } : {},
        runs: []
      };
      const saved = await store.insert(task);
      await engine.reschedule();
      return saved;
    },
    /** Replace the given fields; a changed schedule (or re-enabling) recomputes the next run from now. */
    async update(id, input) {
      const at = now();
      const workspace = input.workspace === void 0 ? void 0 : await checkWorkspace(input.workspace);
      const saved = await store.update(id, (task) => {
        if (input.title !== void 0) task.title = text(input.title, "title", 80, true);
        if (input.prompt !== void 0) task.prompt = text(input.prompt, "prompt", 2e4, true);
        if (workspace !== void 0) task.workspace = workspace;
        if (input.connectors !== void 0) task.connectors = (Array.isArray(input.connectors) ? input.connectors : []).map(String).filter(Boolean).slice(0, 20);
        if (input.misfire !== void 0) task.misfire = input.misfire === "skip" ? "skip" : "run_once";
        if (input.model !== void 0) {
          if (modelOf(input.model)) task.model = modelOf(input.model);
          else delete task.model;
        }
        if (input.permissionPreset !== void 0) {
          if (input.permissionPreset) task.permissionPreset = String(input.permissionPreset);
          else delete task.permissionPreset;
        }
        let retime = false;
        if (input.schedule !== void 0) {
          task.schedule = wrapRule(() => normalizeRule(input.schedule, { now: at, defaultTimeZone: task.schedule.timeZone }));
          retime = true;
        }
        if (input.enabled !== void 0 && Boolean(input.enabled) !== task.enabled) {
          task.enabled = Boolean(input.enabled);
          retime = task.enabled;
        }
        if (retime) {
          const next = nextOccurrence(task.schedule, at);
          if (!next && task.enabled) throw new TaskError("\u8FD9\u4E2A\u65F6\u95F4\u89C4\u5219\u4EE5\u540E\u4E0D\u4F1A\u518D\u89E6\u53D1\uFF08\u4E00\u6B21\u6027\u4EFB\u52A1\u7684\u65F6\u95F4\u5DF2\u7ECF\u8FC7\u53BB\uFF09\uFF0C\u8BF7\u5148\u4FEE\u6539\u65F6\u95F4", 400, "This schedule never fires again (the one-time date has passed). Change the time first.");
          task.nextRunAt = next ? next.toISOString() : null;
        }
        task.updatedAt = at.toISOString();
        return task;
      });
      await engine.reschedule();
      return saved;
    },
    async remove(id) {
      const removed = await store.remove(id);
      await engine.reschedule();
      return removed;
    }
  };
}

// src/host/routes.js
var json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
async function body(request) {
  try {
    return await request.json();
  } catch {
    throw new TaskError("\u8BF7\u6C42\u4F53\u4E0D\u662F\u6709\u6548\u7684 JSON", 400, "The request body is not valid JSON");
  }
}
var english = (request) => new URL(request.url).searchParams.get("lang") === "en";
function chatOpening({ task, text: text2, en }) {
  if (task) {
    return en ? `I want to change the scheduled task \u201C${task.title}\u201D (id: ${task.id}). Look it up with scheduler_list, tell me its current setup in a sentence or two, then ask what I want to change; apply it with scheduler_update.` : `\u6211\u60F3\u8C03\u6574\u5B9A\u65F6\u4EFB\u52A1\u300C${task.title}\u300D\uFF08id\uFF1A${task.id}\uFF09\u3002\u5148\u7528 scheduler_list \u67E5\u4E00\u4E0B\u5B83\u73B0\u5728\u7684\u8BBE\u7F6E\uFF0C\u7528\u4E00\u4E24\u53E5\u8BDD\u544A\u8BC9\u6211\uFF0C\u7136\u540E\u95EE\u6211\u60F3\u6539\u4EC0\u4E48\uFF1B\u6539\u7684\u65F6\u5019\u7528 scheduler_update\u3002`;
  }
  if (text2) {
    return en ? `Set up a scheduled task: ${text2}. Ask me about anything unclear first, then create it with scheduler_create.` : `\u5E2E\u6211\u5EFA\u4E00\u4E2A\u5B9A\u65F6\u4EFB\u52A1\uFF1A${text2}\u3002\u6709\u4E0D\u6E05\u695A\u7684\u5148\u95EE\u6211\uFF0C\u7136\u540E\u7528 scheduler_create \u521B\u5EFA\u3002`;
  }
  return en ? "I want to set up a scheduled task. Ask me what should run and when, then create it with scheduler_create." : "\u6211\u60F3\u65B0\u5EFA\u4E00\u4E2A\u5B9A\u65F6\u4EFB\u52A1\u3002\u5148\u95EE\u6211\u8981\u5B9A\u65F6\u505A\u4EC0\u4E48\u3001\u4EC0\u4E48\u65F6\u5019\u505A\uFF0C\u95EE\u6E05\u695A\u540E\u7528 scheduler_create \u521B\u5EFA\u3002";
}
function registerRoutes(ctx, { store, tasks, engine, changes, models, startSession, defaultWorkspace = () => void 0, now = () => /* @__PURE__ */ new Date() }) {
  const requireId = (input) => {
    if (typeof input?.id !== "string" || input.id === "") throw new TaskError("\u7F3A\u5C11\u4EFB\u52A1 id", 400, "Missing task id");
    return input.id;
  };
  const views = async (viewerZone) => (await store.list()).map((task) => viewTask(task, { viewerZone, preview: 3, now: now() })).sort((a, b2) => a.enabled === b2.enabled ? (a.nextRunAt ?? "9").localeCompare(b2.nextRunAt ?? "9") : a.enabled ? -1 : 1);
  const routes = [
    ["GET", "/api/scheduler/tasks", async (request, url) => json({
      tasks: await views(url.searchParams.get("tz") ?? void 0),
      hostTimeZone: hostTimeZone(),
      revision: changes.revision,
      ...await models.describe()
    })],
    ["GET", "/api/scheduler/wait", async (request, url) => {
      const since = Number(url.searchParams.get("revision") ?? -1);
      if (changes.revision === since) {
        await new Promise((resolve) => {
          const timer = setTimeout(done, 5e3);
          const unsubscribe = changes.subscribe(done);
          request.signal?.addEventListener("abort", done, { once: true });
          function done() {
            clearTimeout(timer);
            unsubscribe();
            resolve();
          }
        });
      }
      return json({ revision: changes.revision });
    }],
    ["GET", "/api/scheduler/runs", async (request, url) => {
      const task = await store.get(url.searchParams.get("id") ?? "");
      if (!task) throw new TaskError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404, "Task not found");
      return json({ runs: [...task.runs ?? []].reverse() });
    }],
    // Only the basics: the schedule (the page sends time/weekday changes of the stored rule) and the model.
    ["POST", "/api/scheduler/update", async (request) => {
      const input = await body(request);
      const fields = {};
      if (input.schedule !== void 0) fields.schedule = input.schedule;
      if (input.model !== void 0) fields.model = input.model === null ? null : await models.resolve(input.model);
      return json({ task: viewTask(await tasks.update(requireId(input), fields), { preview: 3, now: now() }) });
    }],
    // Open a chat about a task (or a new one) and let the agent take it from there.
    ["POST", "/api/scheduler/chat", async (request) => {
      const input = await body(request);
      const task = input.id ? await store.get(input.id) : void 0;
      if (input.id && !task) throw new TaskError("\u4EFB\u52A1\u4E0D\u5B58\u5728", 404, "Task not found");
      const workspace = task?.workspace ?? defaultWorkspace();
      if (!workspace) throw new TaskError("\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u533A\uFF1A\u5148\u5728 DSH \u91CC\u6253\u5F00\u4E00\u4E2A\u6587\u4EF6\u5939", 400, "No workspace yet: open a folder in DSH first");
      const en = english(request);
      const title = task ? `\u23F0 ${task.title}` : en ? "\u23F0 New scheduled task" : "\u23F0 \u65B0\u5EFA\u5B9A\u65F6\u4EFB\u52A1";
      const text2 = chatOpening({ task, text: typeof input.text === "string" ? input.text.trim().slice(0, 500) : void 0, en });
      return json(await startSession({ workspace, title, text: text2, kind: "user" }));
    }],
    ["POST", "/api/scheduler/toggle", async (request) => {
      const input = await body(request);
      return json({ task: viewTask(await tasks.update(requireId(input), { enabled: input.enabled === true }), { preview: 3, now: now() }) });
    }],
    ["POST", "/api/scheduler/run", async (request) => json({ run: await engine.runNow(requireId(await body(request))) })],
    ["POST", "/api/scheduler/delete", async (request) => json({ deleted: await tasks.remove(requireId(await body(request))) })]
  ];
  for (const [method, path, fn] of routes) {
    ctx.effect(() => ctx.connection.fetch.register({
      path,
      methods: [method],
      requestBody: "buffered",
      fetch: async (request) => {
        try {
          return await fn(request, new URL(request.url));
        } catch (error) {
          const message = english(request) && error?.en ? error.en : error?.message ?? String(error);
          return json({ error: message }, error instanceof TaskError ? error.status : 500);
        }
      }
    }), "dsh-scheduler: " + path);
  }
}

// src/host/runner.js
import { randomUUID } from "node:crypto";
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
function scheduleMessage(text2, kind = "schedule") {
  return deepFreeze({ role: "user", id: randomUUID(), content: [{ type: "text", text: text2 }], source: { kind } });
}
function installInitialModelSelection(agentCtx, selection) {
  if (selection.reasoningEffort === void 0) return;
  agentCtx.on("agent/request", async ({ agent }, next) => {
    const resolved = await next();
    if (agent.session.requestHeader() !== void 0 || resolved.provider !== selection.provider || resolved.model !== selection.model) return resolved;
    return { ...resolved, reasoningEffort: selection.reasoningEffort };
  });
}
function createSessionRunner(ctx) {
  return async function startSession({ workspace, title, text: text2, kind, model, agentPreset, permissionPreset, signal }) {
    const permission = permissionPreset || ctx.permissionPresets.catalog().defaultPreset;
    ctx.permissionPresets.resolve(permission);
    const preset = await ctx.agentPresets.resolve(agentPreset || void 0);
    const scope = await ctx.agentPresets.acquireScope(preset.id);
    try {
      const space = await ctx.workspaceRegistry.create(workspace);
      const selection = model?.provider && model?.model ? { provider: model.provider, model: model.model, ...model.reasoningEffort ? { reasoningEffort: model.reasoningEffort } : {} } : { ...ctx.agentDefaultModel.currentSelection() };
      const sessionId = randomUUID();
      const handle = await ctx.agents.create({
        sessionId,
        signal,
        meta: { cwd: space.path, agentPreset: preset.id },
        agentOptions: { provider: selection.provider, model: selection.model },
        setup: async (agentCtx) => {
          await ctx.agentPresets.mount(agentCtx, preset.id);
          installInitialModelSelection(agentCtx, selection);
        }
      });
      let attached = false;
      try {
        await space.attachSession(sessionId);
        attached = true;
        ctx.permissionPresets.set(handle.agent.session, permission);
        ctx.get("sessionTitle")?.rename(handle.agent.session, title);
        handle.agent.followup(scheduleMessage(text2, kind));
      } catch (error) {
        if (attached) await space.detachSession(sessionId).catch(() => {
        });
        await handle.dispose().catch(() => {
        });
        throw error;
      }
      return { sessionId };
    } finally {
      await scope[Symbol.asyncDispose]?.();
    }
  };
}

// src/host/tools.js
var SCHEDULE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  description: "When the task runs. Wall-clock rules are interpreted in time_zone.",
  properties: {
    type: {
      type: "string",
      enum: ["once", "every", "daily", "weekly", "monthly", "cron"],
      description: 'once: a single time ("\u660E\u5929\u4E0B\u53483\u70B9"); every: fixed interval ("\u6BCF2\u5C0F\u65F6", "\u6BCF30\u5206\u949F"); daily: every day at `time`; weekly: on `weekdays` at `time` ("\u5DE5\u4F5C\u65E5\u65E9\u4E0A9\u70B9" \u2192 weekdays [1,2,3,4,5]); monthly: on `days` of the month at `time`; cron: anything else, as a standard 5-field cron.'
    },
    at: { type: "string", description: 'once: local date and time "YYYY-MM-DD HH:MM" in time_zone (resolve relative dates like \u660E\u5929/\u4E0B\u5468\u4E00 yourself from the current date).' },
    every_minutes: { type: "number", description: "every: interval in minutes (\u2265 1). 2 hours = 120." },
    time: { type: "string", description: 'daily/weekly/monthly: 24-hour "HH:MM".' },
    weekdays: { type: "array", items: { type: "integer" }, description: "weekly: ISO weekdays, Monday = 1 \u2026 Sunday = 7." },
    days: { type: "array", items: { type: "integer" }, description: "monthly: days of month 1\u201331." },
    cron: { type: "string", description: 'cron: "minute hour day-of-month month day-of-week", e.g. "0 9-18/3 * * 1-5".' },
    time_zone: { type: "string", description: "IANA time zone, e.g. Asia/Shanghai. Default: the user's browser time zone." }
  }
};
var TASK_FIELDS = {
  title: { type: "string", description: 'Short name shown in the task list, e.g. "\u65E9\u95F4\u90AE\u4EF6\u6458\u8981" (\u2264 80 chars).' },
  prompt: {
    type: "string",
    description: "The complete instruction a future agent will follow on every run. It will NOT see this conversation, so make it self-contained: what to check, which connector/tools to use, how to filter (e.g. only mail since the last run), the output format, and where to deliver results (e.g. reply in the session, or send an email). Write it in the user's language."
  },
  schedule: SCHEDULE_SCHEMA,
  workspace: { type: "string", description: "Absolute path of the workspace the runs happen in. Default: the current session's workspace." },
  connectors: { type: "array", items: { type: "string" }, description: `Names of connectors the task relies on (e.g. ["gmail"]); see connectors_list. They are named in each run's instructions.` },
  misfire: { type: "string", enum: ["run_once", "skip"], description: "If the computer was asleep/closed at the scheduled time: run_once (default) catches up once when possible; skip ignores runs more than 15 minutes late." },
  enabled: { type: "boolean", description: "Default true. false creates it paused." },
  model: { type: "string", description: `Only when the user names a model for this task, e.g. "Opus 5.5" or "claude/claude-opus-5-5" (display names work). Omit to follow DSH's default model at each run; "default" switches an existing task back to that.` },
  reasoning_effort: { type: "string", description: "Thinking effort for the task's model, e.g. low / medium / high / max. Only when the user asks." }
};
var OUTPUT = {
  schema: { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" }, taskId: { type: "string" } } },
  render: (_args, value) => [{ type: "text", text: value.text }]
};
function callerTimeZone(exec) {
  try {
    const messages = exec?.agent?.session?.deriveMessages?.() ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const zone = messages[i]?.role === "user" ? messages[i].source?.clientTimeZone : void 0;
      if (isTimeZone(zone)) return zone;
    }
  } catch {
  }
  return hostTimeZone();
}
function registerTools(ctx, { tasks, store, engine, models, now = () => /* @__PURE__ */ new Date() }) {
  const register = (definition) => ctx.effect(() => ctx.tools.register({ output: OUTPUT, ...definition }), `dsh-scheduler: ${definition.name}`);
  const json2 = (value) => JSON.stringify(value, null, 2);
  const view = async (task, exec, preview = 3) => {
    const base = viewTask(task, { viewerZone: callerTimeZone(exec), preview, now: now() });
    const def = models.defaultSelection();
    return { ...base, modelText: task.model ? await models.label(task.model) : `\u8DDF\u968F DSH \u9ED8\u8BA4\u6A21\u578B\uFF08\u5F53\u524D\uFF1A${await models.label(def) ?? "\u672A\u77E5"}\uFF09` };
  };
  const pickModel = async (args, current) => {
    if (args.model !== void 0) return models.resolve(args.model, args.reasoning_effort);
    if (args.reasoning_effort === void 0) return void 0;
    const base = current ?? models.defaultSelection();
    return models.resolve(base, args.reasoning_effort);
  };
  const findTask = async (id) => {
    const task = await store.get(String(id ?? ""));
    if (!task) throw new TaskError(`\u627E\u4E0D\u5230\u4EFB\u52A1 ${id}\uFF1B\u5148\u7528 scheduler_list \u67E5\u770B\u73B0\u6709\u4EFB\u52A1\u7684 id`);
    return task;
  };
  register({
    name: "scheduler_create",
    description: [
      "Create a scheduled task that runs automatically, without the user present. At every occurrence a NEW session starts in the task's workspace and an agent carries out `prompt` on its own; it has the same tools as you, including connector tools (mcp__gmail__search_emails \u2026).",
      `Use it whenever the user asks, in any wording, for something to happen later or repeatedly: "\u6BCF\u4E2A\u5DE5\u4F5C\u65E5\u65E9\u4E0A 9 \u70B9\u68C0\u67E5 Gmail \u65B0\u90AE\u4EF6\u5E76\u603B\u7ED3", "\u6BCF 2 \u5C0F\u65F6\u770B\u4E00\u4E0B\u670D\u52A1\u5668\u72B6\u6001", "\u660E\u5929\u4E0B\u5348 3 \u70B9\u63D0\u9192\u6211\u7ED9\u738B\u603B\u56DE\u90AE\u4EF6", "every Monday summarize last week's GitHub issues".`,
      "Turn the timing into `schedule` yourself (resolve \u660E\u5929/\u4E0B\u5468\u4E00/\u4ECA\u665A from the current date; \u65E9\u4E0A 9 \u70B9 \u2192 09:00, \u665A\u4E0A 8 \u70B9 \u2192 20:00). If the timing is genuinely ambiguous, ask first. If the task needs an external system (email, GitHub\u2026), call connectors_list first and pass the connector names.",
      'After creating, tell the user in one or two sentences what will run and when (use scheduleText and upcoming from the result), and that they can manage it in the "\u5B9A\u65F6\u4EFB\u52A1" page of the left sidebar.'
    ].join("\n"),
    parameters: { type: "object", additionalProperties: false, required: ["title", "prompt", "schedule"], properties: TASK_FIELDS },
    async execute(args, exec) {
      const workspace = args.workspace || exec?.agent?.session?.header?.cwd;
      if (!workspace) throw new TaskError("\u8FD9\u4E2A\u4F1A\u8BDD\u6CA1\u6709\u5DE5\u4F5C\u533A\uFF0C\u8BF7\u6307\u5B9A workspace\uFF08\u7EDD\u5BF9\u8DEF\u5F84\uFF09");
      const { model: _m, reasoning_effort: _e, ...rest } = args;
      const model = await pickModel(args);
      const created = await tasks.create({ ...rest, model: model ?? void 0, workspace, defaultTimeZone: callerTimeZone(exec) }, { createdFrom: exec?.agent?.id ? String(exec.agent.id) : void 0 });
      return { taskId: created.id, text: json2({ created: true, task: await view(created, exec) }) };
    }
  });
  register({
    name: "scheduler_list",
    description: "List the user's scheduled tasks with their rule in words, next run, last run result and id. Use before updating/deleting, or when the user asks what is scheduled.",
    parameters: { type: "object", additionalProperties: false, properties: { include_paused: { type: "boolean", description: "Include paused tasks (default true)." } } },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const list = (await store.list()).filter((t) => args.include_paused !== false || t.enabled);
      if (list.length === 0) return { text: "\u8FD8\u6CA1\u6709\u5B9A\u65F6\u4EFB\u52A1\u3002" };
      return { text: json2(await Promise.all(list.map(async (task) => {
        const { prompt, ...rest } = await view(task, exec, 1);
        return { ...rest, prompt: prompt.length > 300 ? `${prompt.slice(0, 300)}\u2026` : prompt };
      }))) };
    }
  });
  register({
    name: "scheduler_update",
    description: "Change a scheduled task: rename it, rewrite its instruction, change when it runs or which model it uses, pause (enabled: false) or resume it. Only the fields you pass change; a new schedule or resuming recomputes the next run from now.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: { id: { type: "string", description: "Task id from scheduler_list." }, ...TASK_FIELDS }
    },
    async execute(args, exec) {
      const task = await findTask(args.id);
      const { id, model: _m, reasoning_effort: _e, ...fields } = args;
      if (fields.schedule && !fields.schedule.time_zone) fields.schedule = { ...fields.schedule, time_zone: task.schedule.timeZone };
      const model = await pickModel(args, task.model);
      if (model !== void 0) fields.model = model;
      const updated = await tasks.update(task.id, fields);
      return { taskId: updated.id, text: json2({ updated: true, task: await view(updated, exec) }) };
    }
  });
  register({
    name: "scheduler_delete",
    description: "Delete a scheduled task permanently (its past run sessions stay). To stop it temporarily, use scheduler_update with enabled: false instead.",
    parameters: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string" } } },
    async execute(args) {
      const task = await findTask(args.id);
      await tasks.remove(task.id);
      return { taskId: task.id, text: `\u5DF2\u5220\u9664\u5B9A\u65F6\u4EFB\u52A1\u300C${task.title}\u300D\u3002` };
    }
  });
  register({
    name: "scheduler_run_now",
    description: "Run a scheduled task once right now, in a new session, without changing its schedule. Useful to test a task just created. Returns immediately with the new session id; the run continues in the background.",
    parameters: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string" } } },
    async execute(args) {
      const task = await findTask(args.id);
      const run = await engine.runNow(task.id);
      if (run.status === "failed" || run.status === "skipped") throw new TaskError(run.error ?? "\u8FD0\u884C\u5931\u8D25");
      return { taskId: task.id, text: json2({ started: true, runId: run.id, sessionId: run.sessionId, note: "\u4EFB\u52A1\u5DF2\u5728\u65B0\u4F1A\u8BDD\u4E2D\u5F00\u59CB\u8FD0\u884C\uFF0C\u5B8C\u6210\u540E\u53EF\u5728\u300C\u5B9A\u65F6\u4EFB\u52A1\u300D\u9875\u9762\u67E5\u770B\u7ED3\u679C\u3002" }) };
    }
  });
  register({
    name: "scheduler_runs",
    description: "Show a task's recent runs: when, status (completed/failed/aborted/skipped/missed/interrupted/running), the session id, and the final answer summary.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: { id: { type: "string" }, limit: { type: "integer", description: "Most recent runs to show (default 10)." } }
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const task = await findTask(args.id);
      const limit = Math.min(50, Math.max(1, args.limit ?? 10));
      const runs = [...task.runs ?? []].reverse().slice(0, limit);
      return { taskId: task.id, text: runs.length ? json2(runs) : `\u4EFB\u52A1\u300C${task.title}\u300D\u8FD8\u6CA1\u6709\u8FD0\u884C\u8FC7\u3002` };
    }
  });
}

// src/host/index.js
var name = "dsh-scheduler";
var inject = ["connection", "tools", "agents", "agentPresets", "permissionPresets", "workspaceRegistry", "agentDefaultModel"];
function connectorsLine(ctx, task) {
  if (!task.connectors?.length) return void 0;
  const names = new Set((ctx.tools.schemas?.() ?? []).map((schema) => schema.name));
  const parts = task.connectors.map((connector) => {
    const prefix = `mcp__${connector.replace(/-/g, "_")}__`;
    const live = [...names].some((n) => n.startsWith(prefix));
    return `${connector}\uFF08\u5DE5\u5177\u540D\u4EE5 ${prefix} \u5F00\u5934${live ? "" : "\uFF0C\u26A0\uFE0F \u5F53\u524D\u672A\u8FDE\u63A5\uFF1A\u5982\u679C\u8C03\u7528\u5931\u8D25\uFF0C\u8BF7\u5728\u7ED3\u679C\u91CC\u63D0\u9192\u7528\u6237\u5230\u300C\u8FDE\u63A5\u5668\u300D\u9875\u9762\u91CD\u65B0\u8FDE\u63A5"}\uFF09`;
  });
  return `\u672C\u4EFB\u52A1\u4F7F\u7528\u7684\u8FDE\u63A5\u5668\uFF1A${parts.join("\uFF1B")}`;
}
function apply(ctx, config = {}) {
  const log = (message) => ctx.logger?.warn?.(message);
  const store = createStore({ dir: config.dataDir ?? defaultDataDir() });
  const listeners = /* @__PURE__ */ new Set();
  const changes = {
    revision: 0,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    bump() {
      changes.revision++;
      for (const fn of listeners) fn();
    }
  };
  const now = config.now ?? (() => /* @__PURE__ */ new Date());
  const models = config.models ?? createModelCatalog(ctx);
  const startSession = config.startSession ?? createSessionRunner(ctx);
  const engine = createEngine({
    chooseModel: (pinned) => models.pickRunnable(pinned),
    store,
    log,
    now,
    onChange: () => changes.bump(),
    ...config.timers ? { timers: config.timers } : {},
    startSession,
    connectorsText: (task) => connectorsLine(ctx, task)
  });
  const tasks = createTasks({ store, engine, now, defaultTimeZone: hostTimeZone });
  ctx.on("session/event", (session, event) => engine.onSessionEvent(session, event));
  ctx.effect(() => () => engine.stop(), "dsh-scheduler: timer");
  const defaultWorkspace = () => ctx.workspaceRegistry.list?.()?.[0]?.path;
  registerRoutes(ctx, { store, tasks, engine, changes, models, startSession, defaultWorkspace, now });
  registerTools(ctx, { tasks, store, engine, models, now });
  engine.start().catch((error) => log(`dsh-scheduler: \u542F\u52A8\u5931\u8D25\uFF1A${error.message}`));
}
export {
  apply,
  inject,
  name
};
