/**
 * @generated
 * Contract: schema/plugin-schema.schema.json
 * Contract SHA-256: 41513cb2589ea9c333f59b3c337a9a15af29834ae66ffc9e93a6f099eec58e3c
 * Command: bun run schema:validator:build
 * Bun: 1.3.14
 * Ajv: 8.20.0
 * ajv-formats: 3.0.1
 * Producer policy: Canonical artifacts are produced on Linux x64 with Bun 1.3.14.
 * Third-party notices: ../THIRD_PARTY_NOTICES.md
 */
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  function ucs2length(str) {
    const len = str.length;
    let length = 0;
    let pos = 0;
    let value;
    while (pos < len) {
      length++;
      value = str.charCodeAt(pos++);
      if (value >= 55296 && value <= 56319 && pos < len) {
        value = str.charCodeAt(pos);
        if ((value & 64512) === 56320)
          pos++;
      }
    }
    return length;
  }
  exports.default = ucs2length;
  ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
});

// node_modules/ajv-formats/dist/formats.js
var require_formats = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.formatNames = exports.fastFormats = exports.fullFormats = undefined;
  function fmtDef(validate, compare) {
    return { validate, compare };
  }
  exports.fullFormats = {
    date: fmtDef(date, compareDate),
    time: fmtDef(getTime(true), compareTime),
    "date-time": fmtDef(getDateTime(true), compareDateTime),
    "iso-time": fmtDef(getTime(), compareIsoTime),
    "iso-date-time": fmtDef(getDateTime(), compareIsoDateTime),
    duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
    uri,
    "uri-reference": /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
    "uri-template": /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
    url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
    email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
    hostname: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
    ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
    ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
    regex,
    uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
    "json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
    "json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
    "relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
    byte,
    int32: { type: "number", validate: validateInt32 },
    int64: { type: "number", validate: validateInt64 },
    float: { type: "number", validate: validateNumber },
    double: { type: "number", validate: validateNumber },
    password: true,
    binary: true
  };
  exports.fastFormats = {
    ...exports.fullFormats,
    date: fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, compareDate),
    time: fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareTime),
    "date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareDateTime),
    "iso-time": fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoTime),
    "iso-date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoDateTime),
    uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
    "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
    email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i
  };
  exports.formatNames = Object.keys(exports.fullFormats);
  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }
  var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
  var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function date(str) {
    const matches = DATE.exec(str);
    if (!matches)
      return false;
    const year = +matches[1];
    const month = +matches[2];
    const day = +matches[3];
    return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
  }
  function compareDate(d1, d2) {
    if (!(d1 && d2))
      return;
    if (d1 > d2)
      return 1;
    if (d1 < d2)
      return -1;
    return 0;
  }
  var TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
  function getTime(strictTimeZone) {
    return function time(str) {
      const matches = TIME.exec(str);
      if (!matches)
        return false;
      const hr = +matches[1];
      const min = +matches[2];
      const sec = +matches[3];
      const tz = matches[4];
      const tzSign = matches[5] === "-" ? -1 : 1;
      const tzH = +(matches[6] || 0);
      const tzM = +(matches[7] || 0);
      if (tzH > 23 || tzM > 59 || strictTimeZone && !tz)
        return false;
      if (hr <= 23 && min <= 59 && sec < 60)
        return true;
      const utcMin = min - tzM * tzSign;
      const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
      return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
    };
  }
  function compareTime(s1, s2) {
    if (!(s1 && s2))
      return;
    const t1 = new Date("2020-01-01T" + s1).valueOf();
    const t2 = new Date("2020-01-01T" + s2).valueOf();
    if (!(t1 && t2))
      return;
    return t1 - t2;
  }
  function compareIsoTime(t1, t2) {
    if (!(t1 && t2))
      return;
    const a1 = TIME.exec(t1);
    const a2 = TIME.exec(t2);
    if (!(a1 && a2))
      return;
    t1 = a1[1] + a1[2] + a1[3];
    t2 = a2[1] + a2[2] + a2[3];
    if (t1 > t2)
      return 1;
    if (t1 < t2)
      return -1;
    return 0;
  }
  var DATE_TIME_SEPARATOR = /t|\s/i;
  function getDateTime(strictTimeZone) {
    const time = getTime(strictTimeZone);
    return function date_time(str) {
      const dateTime = str.split(DATE_TIME_SEPARATOR);
      return dateTime.length === 2 && date(dateTime[0]) && time(dateTime[1]);
    };
  }
  function compareDateTime(dt1, dt2) {
    if (!(dt1 && dt2))
      return;
    const d1 = new Date(dt1).valueOf();
    const d2 = new Date(dt2).valueOf();
    if (!(d1 && d2))
      return;
    return d1 - d2;
  }
  function compareIsoDateTime(dt1, dt2) {
    if (!(dt1 && dt2))
      return;
    const [d1, t1] = dt1.split(DATE_TIME_SEPARATOR);
    const [d2, t2] = dt2.split(DATE_TIME_SEPARATOR);
    const res = compareDate(d1, d2);
    if (res === undefined)
      return;
    return res || compareTime(t1, t2);
  }
  var NOT_URI_FRAGMENT = /\/|:/;
  var URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
  function uri(str) {
    return NOT_URI_FRAGMENT.test(str) && URI.test(str);
  }
  var BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
  function byte(str) {
    BYTE.lastIndex = 0;
    return BYTE.test(str);
  }
  var MIN_INT32 = -(2 ** 31);
  var MAX_INT32 = 2 ** 31 - 1;
  function validateInt32(value) {
    return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
  }
  function validateInt64(value) {
    return Number.isInteger(value);
  }
  function validateNumber() {
    return true;
  }
  var Z_ANCHOR = /[^\\]\\Z/;
  function regex(str) {
    if (Z_ANCHOR.test(str))
      return false;
    try {
      new RegExp(str);
      return true;
    } catch (e) {
      return false;
    }
  }
});

var validatePluginSchemaStructure = validate20;
var schema31 = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "https://raw.githubusercontent.com/dejwi/vinela/main/schema/plugin-schema.schema.json", title: "Vinela Plugin Schema", description: "Public authoring contract for repository-root vinela.schema.json files.", type: "object", required: ["id", "pluginName", "pluginRepo", "version", "options", "functions"], properties: { $schema: { type: "string", format: "uri", description: "Editor annotation pointing to the public Vinela JSON Schema." }, id: { type: "string", minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*(?::[A-Za-z0-9][A-Za-z0-9._/-]*)?$", description: "Unique schema identity. Kebab-style and generic namespaced ids such as github:owner/repository are supported." }, pluginName: { $ref: "#/$defs/nonEmptyString", description: "Plugin display name." }, pluginRepo: { type: "string", format: "uri", pattern: "^https?://", description: "HTTP(S) plugin repository URL." }, version: { $ref: "#/$defs/nonEmptyString", description: "Version of this schema definition, not the plugin release." }, description: { type: "string", description: "Longer plugin description." }, pack: { $ref: "#/$defs/pack" }, dependencies: { type: "array", items: { $ref: "#/$defs/nonEmptyString" }, description: "Other Vinela schema ids required by this plugin." }, options: { type: "array", items: { $ref: "#/$defs/schemaOption" }, description: "Configuration fields rendered by Vinela and emitted into Lua." }, functions: { type: "array", items: { $ref: "#/$defs/schemaFunction" }, description: "Plugin functions available to graph authors." }, events: { type: "array", items: { $ref: "#/$defs/nonEmptyString" }, description: "Custom event names emitted by the plugin." }, exCommands: { type: "array", items: { $ref: "#/$defs/exCommand" }, description: "Ex commands supplied by the plugin." }, exCommandTemplates: { type: "array", items: { $ref: "#/$defs/exCommandTemplate" } }, functionTemplates: { type: "array", items: { $ref: "#/$defs/functionTemplate" }, description: "Preconfigured variants of declared plugin functions." }, generationRules: { type: "array", items: { $ref: "#/$defs/generationRule" }, description: "Generic conflict, subtree gate, and subtree filter rules." }, capabilities: { type: "array", items: { $ref: "#/$defs/pluginCapability" }, description: "Generic plugin capabilities consumed by Vinela." }, setup: { $ref: "#/$defs/setup" }, author: { $ref: "#/$defs/nonEmptyString", description: "Fallback author display name for external schemas." }, stars: { type: "integer", minimum: 0, description: "Optional non-negative repository stars snapshot." }, category: { $ref: "#/$defs/pluginCategory", description: "Browse catalog category." }, tags: { type: "array", items: { $ref: "#/$defs/nonEmptyString" }, description: "Search tags for discovery." }, tagline: { type: "string", minLength: 1, maxLength: 120, description: "Short catalog tagline." }, iconUrl: { type: "string", format: "uri", pattern: "^https?://", description: "Optional HTTP(S) icon or logo URL." } }, additionalProperties: false, $defs: { nonEmptyString: { type: "string", minLength: 1 }, portDataType: { type: "string", enum: ["any", "string", "number", "boolean", "buffer", "window", "table", "void"] }, pluginCategory: { type: "string", enum: ["editor", "lsp", "ui", "navigation", "git", "debugging", "syntax", "utility"] }, pack: { type: "object", properties: { name: { $ref: "#/$defs/nonBlankString", description: "Optional vim.pack package-name override." }, version: { type: "object", required: ["mode", "value"], properties: { mode: { type: "string", enum: ["ref", "semver-range"], description: "Whether value is a Git ref or a semantic-version range." }, value: { $ref: "#/$defs/nonBlankString" } }, additionalProperties: false } }, additionalProperties: false, description: "Optional default vim.pack.add installation metadata." }, nonBlankString: { type: "string", pattern: "\\S" }, condition: { type: "object", required: ["key", "equals"], properties: { key: { $ref: "#/$defs/nonBlankString", description: "Schema option key whose effective value controls the condition." }, equals: { type: ["string", "number", "boolean"], description: "Primitive value required for the condition to match." } }, additionalProperties: false }, selectChoice: { type: "object", required: ["value", "label"], properties: { value: { $ref: "#/$defs/nonEmptyString" }, label: { $ref: "#/$defs/nonEmptyString" } }, additionalProperties: false }, noticeWhen: { oneOf: [{ type: "object", required: ["kind"], properties: { kind: { const: "has-explicit-value" } }, additionalProperties: false }, { type: "object", required: ["kind", "value"], properties: { kind: { const: "equals" }, value: { type: ["string", "number", "boolean"] } }, additionalProperties: false }, { type: "object", required: ["kind", "value"], properties: { kind: { const: "not-equals" }, value: { type: ["string", "number", "boolean"] } }, additionalProperties: false }] }, optionNotice: { type: "object", required: ["severity", "surfaces", "when", "message"], properties: { severity: { const: "warning" }, surfaces: { type: "array", minItems: 1, items: { type: "string", enum: ["configuration", "generation"] } }, when: { $ref: "#/$defs/noticeWhen" }, message: { $ref: "#/$defs/nonBlankString" }, details: { $ref: "#/$defs/nonBlankString" }, suggestions: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } } }, additionalProperties: false }, emitInclude: { oneOf: [{ type: "object", required: ["kind"], properties: { kind: { const: "always" } }, additionalProperties: false }, { type: "object", required: ["kind"], properties: { kind: { const: "explicit-only" } }, additionalProperties: false }, { type: "object", required: ["kind"], properties: { kind: { const: "non-default" } }, additionalProperties: false }, { type: "object", required: ["kind"], properties: { kind: { const: "non-empty" } }, additionalProperties: false }] }, jsonValue: { oneOf: [{ type: ["string", "number", "boolean", "null"] }, { type: "array", items: { $ref: "#/$defs/jsonValue" } }, { type: "object", additionalProperties: { $ref: "#/$defs/jsonValue" } }] }, luaValue: { oneOf: [{ type: "object", required: ["kind", "value"], properties: { kind: { const: "json" }, value: { $ref: "#/$defs/jsonValue" } }, additionalProperties: false }, { type: "object", required: ["kind", "lua"], properties: { kind: { const: "lua" }, lua: { $ref: "#/$defs/nonBlankString" } }, additionalProperties: false }] }, valueRule: { type: "object", required: ["kind", "values"], properties: { kind: { const: "value-map" }, values: { type: "object", propertyNames: { minLength: 1 }, additionalProperties: { $ref: "#/$defs/luaValue" } }, onUnknown: { type: "string", enum: ["omit", "emit-original", "warn-and-omit"] } }, additionalProperties: false }, stringRule: { type: "object", required: ["kind"], properties: { kind: { const: "path" }, trim: { type: "boolean" }, omitWhenEmpty: { type: "boolean" }, expandWithVimFnExpand: { type: "boolean" }, warnWhenRelative: { type: "boolean" } }, additionalProperties: false }, optionEmit: { type: "object", properties: { include: { $ref: "#/$defs/emitInclude" }, valueRule: { $ref: "#/$defs/valueRule" }, stringRule: { $ref: "#/$defs/stringRule" } }, additionalProperties: false, description: "Generic Lua emission behavior for an option. stringRule is valid only for string options." }, optionMetadata: { type: "object", required: ["key", "label"], properties: { key: { $ref: "#/$defs/nonEmptyString" }, emitKey: { $ref: "#/$defs/nonBlankString" }, label: { $ref: "#/$defs/nonEmptyString" }, description: { type: "string" }, required: { type: "boolean" }, visibleWhen: { $ref: "#/$defs/condition" }, enabledWhen: { $ref: "#/$defs/condition" }, group: { $ref: "#/$defs/nonEmptyString" }, notices: { type: "array", items: { $ref: "#/$defs/optionNotice" } }, defaultEmission: { type: "string", enum: ["emit", "explicit-only"] } } }, stringValidation: { type: "object", properties: { minLength: { type: "number" }, maxLength: { type: "number" }, pattern: { type: "string" } }, additionalProperties: false }, numberValidation: { type: "object", properties: { min: { type: "number" }, max: { type: "number" }, step: { type: "number" }, integer: { type: "boolean" } }, additionalProperties: false }, arrayValidation: { type: "object", properties: { minItems: { type: "number" }, maxItems: { type: "number" }, uniqueItems: { type: "boolean" } }, additionalProperties: false }, arrayItems: { oneOf: [{ type: "object", required: ["itemType"], properties: { itemType: { const: "string" } }, additionalProperties: false }, { type: "object", required: ["itemType"], properties: { itemType: { const: "number" } }, additionalProperties: false }, { type: "object", required: ["itemType", "options"], properties: { itemType: { const: "select" }, options: { type: "array", minItems: 1, items: { $ref: "#/$defs/selectChoice" } } }, additionalProperties: false }] }, mappingAutoFill: { type: "object", required: ["kind", "sourceColumn", "values"], properties: { kind: { const: "value-by-column" }, sourceColumn: { $ref: "#/$defs/nonBlankString" }, values: { type: "object", propertyNames: { minLength: 1 }, additionalProperties: { type: "string" } }, fallback: { type: "string", enum: ["preserve", "empty", "column-default"] } }, additionalProperties: false }, mappingColumn: { oneOf: [{ type: "object", required: ["key", "label", "type"], properties: { key: { $ref: "#/$defs/nonBlankString" }, label: { $ref: "#/$defs/nonBlankString" }, type: { const: "string" }, default: { type: "string" }, autoFill: { $ref: "#/$defs/mappingAutoFill" } }, additionalProperties: false }, { type: "object", required: ["key", "label", "type", "options"], properties: { key: { $ref: "#/$defs/nonBlankString" }, label: { $ref: "#/$defs/nonBlankString" }, type: { const: "select" }, default: { type: "string" }, autoFill: { $ref: "#/$defs/mappingAutoFill" }, options: { type: "array", minItems: 1, items: { $ref: "#/$defs/selectChoice" } } }, additionalProperties: false }] }, mappingEmit: { type: "object", required: ["targetKey", "keyColumn", "valueColumn", "valueTemplate"], properties: { targetKey: { $ref: "#/$defs/nonBlankString" }, keyColumn: { $ref: "#/$defs/nonBlankString" }, valueColumn: { $ref: "#/$defs/nonBlankString" }, valueTemplate: { $ref: "#/$defs/nonBlankString" }, outputKeyMap: { type: "object", propertyNames: { minLength: 1 }, additionalProperties: { $ref: "#/$defs/nonBlankString" } } }, additionalProperties: false }, mappingConflictGroup: { type: "object", required: ["column", "values", "severity", "message"], properties: { column: { $ref: "#/$defs/nonEmptyString" }, values: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } }, severity: { const: "warning" }, message: { $ref: "#/$defs/nonEmptyString" } }, additionalProperties: false }, mappingDefaultRow: { type: "object", additionalProperties: { type: "string" } }, keymapCommand: { type: "object", required: ["name", "label"], properties: { name: { $ref: "#/$defs/nonEmptyString" }, label: { $ref: "#/$defs/nonEmptyString" }, description: { type: "string" }, isTerminal: { type: "boolean" } }, additionalProperties: false }, keymapPreset: { type: "object", required: ["id", "label", "mappings"], properties: { id: { $ref: "#/$defs/nonEmptyString" }, label: { $ref: "#/$defs/nonEmptyString" }, description: { type: "string" }, mappings: { type: "object", additionalProperties: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } } } }, additionalProperties: false }, schemaOption: { oneOf: [{ type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type"], properties: { type: { const: "string" }, default: { type: "string" }, validation: { $ref: "#/$defs/stringValidation" }, uiHint: { type: "string", enum: ["input", "textarea"] }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type"], properties: { type: { const: "number" }, default: { type: "number" }, validation: { $ref: "#/$defs/numberValidation" }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type"], properties: { type: { const: "boolean" }, default: { type: "boolean" }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type", "options"], properties: { type: { const: "select" }, options: { type: "array", minItems: 1, items: { $ref: "#/$defs/selectChoice" } }, multi: { type: "boolean" }, default: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] }, emit: { $ref: "#/$defs/optionEmit" } }, allOf: [{ if: { properties: { multi: { const: true } }, required: ["multi"] }, then: { properties: { default: { type: "array", items: { type: "string" } } } }, else: { properties: { multi: { const: false }, default: { type: "string" } } } }] }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type", "items"], properties: { type: { const: "array" }, default: { type: "array" }, items: { $ref: "#/$defs/arrayItems" }, validation: { $ref: "#/$defs/arrayValidation" }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type", "columns", "emit"], properties: { type: { const: "mapping-table" }, default: { type: "array", items: { $ref: "#/$defs/mappingDefaultRow" } }, columns: { type: "array", minItems: 1, items: { $ref: "#/$defs/mappingColumn" } }, emit: { $ref: "#/$defs/mappingEmit" }, conflictGroups: { type: "array", items: { $ref: "#/$defs/mappingConflictGroup" } } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type", "properties"], properties: { type: { const: "object" }, default: { type: "object" }, properties: { type: "array", items: { $ref: "#/$defs/schemaOption" } }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type"], properties: { type: { const: "color" }, default: { type: "string" }, format: { type: "string", enum: ["hex", "rgb", "hsl"] }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type"], properties: { type: { const: "keysequence" }, default: { type: "string" }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type"], properties: { type: { const: "lua" }, default: { type: "string" }, inputPlaceholder: { type: "string" }, uiHint: { type: "string", enum: ["input", "textarea"] }, expectedReturnType: { $ref: "#/$defs/portDataType" }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type", "commands", "presets", "defaultPreset"], properties: { type: { const: "plugin-keymap" }, commands: { type: "array", minItems: 1, items: { $ref: "#/$defs/keymapCommand" } }, presets: { type: "array", minItems: 1, items: { $ref: "#/$defs/keymapPreset" } }, defaultPreset: { $ref: "#/$defs/nonEmptyString" }, allowDisable: { type: "boolean" }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }] }, functionDefault: { oneOf: [{ type: "object", required: ["kind", "value"], properties: { kind: { const: "scalar" }, value: { type: ["string", "number", "boolean"] } }, additionalProperties: false }, { type: "object", required: ["kind", "lua"], properties: { kind: { const: "lua" }, lua: { type: "string" } }, additionalProperties: false }, { type: "object", required: ["kind", "values"], properties: { kind: { const: "multiselect" }, values: { type: "array", items: { type: "string" } } }, additionalProperties: false }, { type: "object", required: ["kind", "entries"], properties: { kind: { const: "object" }, entries: { type: "object", additionalProperties: { $ref: "#/$defs/functionDefault" } } }, additionalProperties: false }] }, functionParam: { type: "object", required: ["name", "type"], properties: { name: { $ref: "#/$defs/nonEmptyString" }, type: { $ref: "#/$defs/portDataType" }, optional: { type: "boolean" }, description: { type: "string" }, tier: { type: "string", enum: ["basic", "advanced"] }, group: { type: "string" }, allowedValues: { type: "array", items: { type: "string" } }, allowedValueDescriptions: { type: "object", additionalProperties: { type: "string" } }, multi: { type: "boolean" }, objectShape: { type: "array", items: { $ref: "#/$defs/functionParam" } }, defaultValue: { $ref: "#/$defs/functionDefault" }, portLabel: { type: "string" }, example: { type: "string" } }, additionalProperties: false }, schemaFunction: { type: "object", required: ["name", "params", "luaCall"], properties: { name: { $ref: "#/$defs/nonEmptyString" }, description: { type: "string" }, params: { type: "array", items: { $ref: "#/$defs/functionParam" } }, returns: { $ref: "#/$defs/portDataType" }, luaCall: { $ref: "#/$defs/nonEmptyString" }, paramEmission: { type: "object", properties: { unsetOptional: { type: "string", enum: ["emit-nil", "omit-trailing"] } }, additionalProperties: false }, label: { $ref: "#/$defs/nonEmptyString" }, shortDescription: { $ref: "#/$defs/nonEmptyString" }, whatItDoes: { $ref: "#/$defs/nonEmptyString" }, technicalNote: { $ref: "#/$defs/nonEmptyString" }, isPopular: { type: "boolean" }, aliases: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } }, category: { $ref: "#/$defs/nonEmptyString" }, example: { $ref: "#/$defs/nonEmptyString" }, sourceDoc: { $ref: "#/$defs/nonEmptyString" }, relatedCommand: { $ref: "#/$defs/nonEmptyString" } }, additionalProperties: false }, functionTemplate: { type: "object", required: ["key", "baseFunctionName", "label", "shortDescription", "defaults"], properties: { key: { $ref: "#/$defs/nonEmptyString" }, baseFunctionName: { $ref: "#/$defs/nonEmptyString" }, label: { $ref: "#/$defs/nonEmptyString" }, shortDescription: { $ref: "#/$defs/nonEmptyString" }, whatItDoes: { type: "string" }, defaults: { type: "object", additionalProperties: { $ref: "#/$defs/functionDefault" } }, aliases: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } }, isPopular: { type: "boolean" } }, additionalProperties: false }, exCommandParam: { type: "object", required: ["name", "placeholder", "description"], properties: { name: { $ref: "#/$defs/nonEmptyString" }, placeholder: { type: "string" }, description: { $ref: "#/$defs/nonEmptyString" }, label: { type: "string" }, type: { type: "string", enum: ["string", "number", "boolean", "file-path", "directory-path", "select"] }, optional: { type: "boolean" }, defaultValue: { type: ["string", "number", "boolean"] }, allowedValues: { type: "array", items: { type: "string" } }, allowedValueDescriptions: { type: "object", additionalProperties: { type: "string" } }, tier: { type: "string", enum: ["basic", "advanced"] }, group: { type: "string" }, escape: { const: "ex-argument" }, emit: { $ref: "#/$defs/exCommandParamEmit" } }, allOf: [{ if: { properties: { type: { const: "select" } }, required: ["type"] }, then: { properties: { allowedValues: {} }, required: ["allowedValues"] }, else: { not: { properties: { allowedValues: {} }, required: ["allowedValues"] } } }, { if: { properties: { type: { const: "select" } }, required: ["type"] }, else: { not: { properties: { allowedValueDescriptions: {} }, required: ["allowedValueDescriptions"] } } }, { if: { properties: { type: { const: "number" } }, required: ["type"] }, then: { properties: { defaultValue: { type: "number" } } }, else: { if: { properties: { type: { const: "boolean" } }, required: ["type"] }, then: { properties: { defaultValue: { type: "boolean" } } }, else: { properties: { defaultValue: { type: "string" } } } } }, { if: { properties: { emit: { type: "object", properties: { kind: { const: "flag" } }, required: ["kind"] } }, required: ["emit"] }, then: { properties: { type: { const: "boolean" } }, required: ["type"] } }, { if: { properties: { emit: { type: "object", properties: { kind: { const: "option" } }, required: ["kind"] } }, required: ["emit"] }, then: { properties: { type: { not: { const: "boolean" } } } } }], additionalProperties: false }, exCommandParamEmit: { oneOf: [{ type: "object", required: ["kind"], properties: { kind: { const: "value" } }, additionalProperties: false }, { type: "object", required: ["kind", "token"], properties: { kind: { const: "flag" }, token: { $ref: "#/$defs/nonEmptyString" } }, additionalProperties: false }, { type: "object", required: ["kind", "prefix"], properties: { kind: { const: "option" }, prefix: { $ref: "#/$defs/nonEmptyString" } }, additionalProperties: false }] }, exCommand: { type: "object", required: ["name", "description", "template", "example", "sourceDoc"], properties: { name: { $ref: "#/$defs/nonEmptyString" }, description: { $ref: "#/$defs/nonEmptyString" }, template: { $ref: "#/$defs/nonEmptyString" }, example: { $ref: "#/$defs/nonEmptyString" }, sourceDoc: { $ref: "#/$defs/nonEmptyString" }, params: { type: "array", items: { $ref: "#/$defs/exCommandParam" } }, label: { $ref: "#/$defs/nonEmptyString" }, shortDescription: { $ref: "#/$defs/nonEmptyString" }, category: { $ref: "#/$defs/nonEmptyString" }, whatItDoes: { $ref: "#/$defs/nonEmptyString" }, technicalNote: { $ref: "#/$defs/nonEmptyString" }, isPopular: { type: "boolean" }, aliases: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } } }, additionalProperties: false }, exCommandTemplate: { type: "object", required: ["key", "baseCommandName", "label", "shortDescription", "defaults"], properties: { key: { $ref: "#/$defs/nonEmptyString" }, baseCommandName: { $ref: "#/$defs/nonEmptyString" }, label: { $ref: "#/$defs/nonEmptyString" }, shortDescription: { $ref: "#/$defs/nonEmptyString" }, defaults: { type: "object", additionalProperties: { type: ["string", "number", "boolean"] } }, example: { $ref: "#/$defs/nonEmptyString" }, whatItDoes: { type: "string" }, aliases: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } }, isPopular: { type: "boolean" } }, additionalProperties: false }, generationRule: { oneOf: [{ type: "object", required: ["kind", "left", "right", "severity", "message"], properties: { kind: { const: "conflict" }, left: { $ref: "#/$defs/nonEmptyString" }, right: { $ref: "#/$defs/nonEmptyString" }, severity: { type: "string", enum: ["warning", "error"] }, when: { type: "string", enum: ["both-explicit", "both-meaningful"] }, message: { $ref: "#/$defs/nonEmptyString" } }, additionalProperties: false }, { type: "object", required: ["kind", "scope", "when", "action"], properties: { kind: { const: "subtree-gate" }, scope: { $ref: "#/$defs/nonBlankString" }, when: { $ref: "#/$defs/condition" }, action: { const: "omit-subtree" }, warnOnExplicitDescendants: { type: "boolean" }, message: { $ref: "#/$defs/nonEmptyString" } }, additionalProperties: false }, { type: "object", required: ["kind", "scope", "mode"], properties: { kind: { const: "subtree-filter" }, scope: { $ref: "#/$defs/nonBlankString" }, mode: { const: "meaningful-only" }, preserveKeys: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } } }, additionalProperties: false }] }, pluginCapability: { oneOf: [{ type: "object", required: ["kind", "provider"], properties: { kind: { const: "lsp-package-installer" }, provider: { const: "mason-registry" } }, additionalProperties: false }, { type: "object", required: ["kind", "api", "minNvimVersion"], properties: { kind: { const: "lsp-server-enabler" }, api: { const: "vim.lsp.enable" }, minNvimVersion: { $ref: "#/$defs/nonEmptyString" } }, additionalProperties: false }] }, setup: { oneOf: [{ type: "object", required: ["requirePath"], properties: { requirePath: { $ref: "#/$defs/nonBlankString" }, setupFunction: { $ref: "#/$defs/nonBlankString" }, optionMapping: { type: "string", enum: ["table", "individual"] }, preSetup: { type: "string" }, postSetup: { type: "string" } }, additionalProperties: false }, { type: "object", required: ["requirePath", "render"], properties: { requirePath: { $ref: "#/$defs/nonBlankString" }, preSetup: { type: "string" }, postSetup: { type: "string" }, render: { type: "object", required: ["kind", "template"], properties: { kind: { const: "lua-template" }, template: { $ref: "#/$defs/nonBlankString" } }, additionalProperties: false } }, additionalProperties: false }], description: "Optional plugin startup setup metadata. Raw Lua fields are trusted author content." } } };
var schema157 = { type: "string", enum: ["editor", "lsp", "ui", "navigation", "git", "debugging", "syntax", "utility"] };
var func1 = Object.prototype.hasOwnProperty;
var func2 = require_ucs2length().default;
var formats0 = require_formats().fullFormats.uri;
var pattern4 = new RegExp("^[A-Za-z0-9][A-Za-z0-9._-]*(?::[A-Za-z0-9][A-Za-z0-9._/-]*)?$", "u");
var pattern5 = new RegExp("^https?://", "u");
var schema34 = { type: "object", properties: { name: { $ref: "#/$defs/nonBlankString", description: "Optional vim.pack package-name override." }, version: { type: "object", required: ["mode", "value"], properties: { mode: { type: "string", enum: ["ref", "semver-range"], description: "Whether value is a Git ref or a semantic-version range." }, value: { $ref: "#/$defs/nonBlankString" } }, additionalProperties: false } }, additionalProperties: false, description: "Optional default vim.pack.add installation metadata." };
var pattern6 = new RegExp("\\S", "u");
function validate21(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate21.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (!(key0 === "name" || key0 === "version")) {
        const err0 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.name !== undefined) {
      let data0 = data.name;
      if (typeof data0 === "string") {
        if (!pattern6.test(data0)) {
          const err1 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
      } else {
        const err2 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.version !== undefined) {
      let data1 = data.version;
      if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
        if (data1.mode === undefined) {
          const err3 = { instancePath: instancePath + "/version", schemaPath: "#/properties/version/required", keyword: "required", params: { missingProperty: "mode" }, message: "must have required property '" + "mode" + "'" };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (data1.value === undefined) {
          const err4 = { instancePath: instancePath + "/version", schemaPath: "#/properties/version/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property '" + "value" + "'" };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        for (const key1 in data1) {
          if (!(key1 === "mode" || key1 === "value")) {
            const err5 = { instancePath: instancePath + "/version", schemaPath: "#/properties/version/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors++;
          }
        }
        if (data1.mode !== undefined) {
          let data2 = data1.mode;
          if (typeof data2 !== "string") {
            const err6 = { instancePath: instancePath + "/version/mode", schemaPath: "#/properties/version/properties/mode/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
          if (!(data2 === "ref" || data2 === "semver-range")) {
            const err7 = { instancePath: instancePath + "/version/mode", schemaPath: "#/properties/version/properties/mode/enum", keyword: "enum", params: { allowedValues: schema34.properties.version.properties.mode.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
        if (data1.value !== undefined) {
          let data3 = data1.value;
          if (typeof data3 === "string") {
            if (!pattern6.test(data3)) {
              const err8 = { instancePath: instancePath + "/version/value", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
              if (vErrors === null) {
                vErrors = [err8];
              } else {
                vErrors.push(err8);
              }
              errors++;
            }
          } else {
            const err9 = { instancePath: instancePath + "/version/value", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
      } else {
        const err10 = { instancePath: instancePath + "/version", schemaPath: "#/properties/version/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
  } else {
    const err11 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  validate21.errors = vErrors;
  return errors === 0;
}
validate21.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema38 = { oneOf: [{ type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type"], properties: { type: { const: "string" }, default: { type: "string" }, validation: { $ref: "#/$defs/stringValidation" }, uiHint: { type: "string", enum: ["input", "textarea"] }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type"], properties: { type: { const: "number" }, default: { type: "number" }, validation: { $ref: "#/$defs/numberValidation" }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type"], properties: { type: { const: "boolean" }, default: { type: "boolean" }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type", "options"], properties: { type: { const: "select" }, options: { type: "array", minItems: 1, items: { $ref: "#/$defs/selectChoice" } }, multi: { type: "boolean" }, default: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] }, emit: { $ref: "#/$defs/optionEmit" } }, allOf: [{ if: { properties: { multi: { const: true } }, required: ["multi"] }, then: { properties: { default: { type: "array", items: { type: "string" } } } }, else: { properties: { multi: { const: false }, default: { type: "string" } } } }] }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type", "items"], properties: { type: { const: "array" }, default: { type: "array" }, items: { $ref: "#/$defs/arrayItems" }, validation: { $ref: "#/$defs/arrayValidation" }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type", "columns", "emit"], properties: { type: { const: "mapping-table" }, default: { type: "array", items: { $ref: "#/$defs/mappingDefaultRow" } }, columns: { type: "array", minItems: 1, items: { $ref: "#/$defs/mappingColumn" } }, emit: { $ref: "#/$defs/mappingEmit" }, conflictGroups: { type: "array", items: { $ref: "#/$defs/mappingConflictGroup" } } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type", "properties"], properties: { type: { const: "object" }, default: { type: "object" }, properties: { type: "array", items: { $ref: "#/$defs/schemaOption" } }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type"], properties: { type: { const: "color" }, default: { type: "string" }, format: { type: "string", enum: ["hex", "rgb", "hsl"] }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type"], properties: { type: { const: "keysequence" }, default: { type: "string" }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type"], properties: { type: { const: "lua" }, default: { type: "string" }, inputPlaceholder: { type: "string" }, uiHint: { type: "string", enum: ["input", "textarea"] }, expectedReturnType: { $ref: "#/$defs/portDataType" }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }, { type: "object", allOf: [{ $ref: "#/$defs/optionMetadata" }, { type: "object", required: ["type", "commands", "presets", "defaultPreset"], properties: { type: { const: "plugin-keymap" }, commands: { type: "array", minItems: 1, items: { $ref: "#/$defs/keymapCommand" } }, presets: { type: "array", minItems: 1, items: { $ref: "#/$defs/keymapPreset" } }, defaultPreset: { $ref: "#/$defs/nonEmptyString" }, allowDisable: { type: "boolean" }, emit: { $ref: "#/$defs/optionEmit" } } }], unevaluatedProperties: false }] };
var schema83 = { type: "string", enum: ["any", "string", "number", "boolean", "buffer", "window", "table", "void"] };
var schema39 = { type: "object", required: ["key", "label"], properties: { key: { $ref: "#/$defs/nonEmptyString" }, emitKey: { $ref: "#/$defs/nonBlankString" }, label: { $ref: "#/$defs/nonEmptyString" }, description: { type: "string" }, required: { type: "boolean" }, visibleWhen: { $ref: "#/$defs/condition" }, enabledWhen: { $ref: "#/$defs/condition" }, group: { $ref: "#/$defs/nonEmptyString" }, notices: { type: "array", items: { $ref: "#/$defs/optionNotice" } }, defaultEmission: { type: "string", enum: ["emit", "explicit-only"] } } };
var schema43 = { type: "object", required: ["key", "equals"], properties: { key: { $ref: "#/$defs/nonBlankString", description: "Schema option key whose effective value controls the condition." }, equals: { type: ["string", "number", "boolean"], description: "Primitive value required for the condition to match." } }, additionalProperties: false };
function validate25(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate25.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.key === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "key" }, message: "must have required property '" + "key" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.equals === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "equals" }, message: "must have required property '" + "equals" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "key" || key0 === "equals")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.key !== undefined) {
      let data0 = data.key;
      if (typeof data0 === "string") {
        if (!pattern6.test(data0)) {
          const err3 = { instancePath: instancePath + "/key", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/key", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.equals !== undefined) {
      let data1 = data.equals;
      if (typeof data1 !== "string" && !(typeof data1 == "number" && isFinite(data1)) && typeof data1 !== "boolean") {
        const err5 = { instancePath: instancePath + "/equals", schemaPath: "#/properties/equals/type", keyword: "type", params: { type: schema43.properties.equals.type }, message: "must be string,number,boolean" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
  } else {
    const err6 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err6];
    } else {
      vErrors.push(err6);
    }
    errors++;
  }
  validate25.errors = vErrors;
  return errors === 0;
}
validate25.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema46 = { type: "object", required: ["severity", "surfaces", "when", "message"], properties: { severity: { const: "warning" }, surfaces: { type: "array", minItems: 1, items: { type: "string", enum: ["configuration", "generation"] } }, when: { $ref: "#/$defs/noticeWhen" }, message: { $ref: "#/$defs/nonBlankString" }, details: { $ref: "#/$defs/nonBlankString" }, suggestions: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } } }, additionalProperties: false };
var schema47 = { oneOf: [{ type: "object", required: ["kind"], properties: { kind: { const: "has-explicit-value" } }, additionalProperties: false }, { type: "object", required: ["kind", "value"], properties: { kind: { const: "equals" }, value: { type: ["string", "number", "boolean"] } }, additionalProperties: false }, { type: "object", required: ["kind", "value"], properties: { kind: { const: "not-equals" }, value: { type: ["string", "number", "boolean"] } }, additionalProperties: false }] };
function validate28(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate28.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.severity === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "severity" }, message: "must have required property '" + "severity" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.surfaces === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "surfaces" }, message: "must have required property '" + "surfaces" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.when === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "when" }, message: "must have required property '" + "when" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.message === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "message" }, message: "must have required property '" + "message" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "severity" || key0 === "surfaces" || key0 === "when" || key0 === "message" || key0 === "details" || key0 === "suggestions")) {
        const err4 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.severity !== undefined) {
      if (data.severity !== "warning") {
        const err5 = { instancePath: instancePath + "/severity", schemaPath: "#/properties/severity/const", keyword: "const", params: { allowedValue: "warning" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.surfaces !== undefined) {
      let data1 = data.surfaces;
      if (Array.isArray(data1)) {
        if (data1.length < 1) {
          const err6 = { instancePath: instancePath + "/surfaces", schemaPath: "#/properties/surfaces/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        const len0 = data1.length;
        for (let i0 = 0;i0 < len0; i0++) {
          let data2 = data1[i0];
          if (typeof data2 !== "string") {
            const err7 = { instancePath: instancePath + "/surfaces/" + i0, schemaPath: "#/properties/surfaces/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
          if (!(data2 === "configuration" || data2 === "generation")) {
            const err8 = { instancePath: instancePath + "/surfaces/" + i0, schemaPath: "#/properties/surfaces/items/enum", keyword: "enum", params: { allowedValues: schema46.properties.surfaces.items.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
          }
        }
      } else {
        const err9 = { instancePath: instancePath + "/surfaces", schemaPath: "#/properties/surfaces/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.when !== undefined) {
      let data3 = data.when;
      const _errs9 = errors;
      let valid4 = false;
      let passing0 = null;
      const _errs10 = errors;
      if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
        if (data3.kind === undefined) {
          const err10 = { instancePath: instancePath + "/when", schemaPath: "#/$defs/noticeWhen/oneOf/0/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        for (const key1 in data3) {
          if (!(key1 === "kind")) {
            const err11 = { instancePath: instancePath + "/when", schemaPath: "#/$defs/noticeWhen/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err11];
            } else {
              vErrors.push(err11);
            }
            errors++;
          }
        }
        if (data3.kind !== undefined) {
          if (data3.kind !== "has-explicit-value") {
            const err12 = { instancePath: instancePath + "/when/kind", schemaPath: "#/$defs/noticeWhen/oneOf/0/properties/kind/const", keyword: "const", params: { allowedValue: "has-explicit-value" }, message: "must be equal to constant" };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
        }
      } else {
        const err13 = { instancePath: instancePath + "/when", schemaPath: "#/$defs/noticeWhen/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
      var _valid0 = _errs10 === errors;
      if (_valid0) {
        valid4 = true;
        passing0 = 0;
        var props0 = true;
      }
      const _errs14 = errors;
      if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
        if (data3.kind === undefined) {
          const err14 = { instancePath: instancePath + "/when", schemaPath: "#/$defs/noticeWhen/oneOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (data3.value === undefined) {
          const err15 = { instancePath: instancePath + "/when", schemaPath: "#/$defs/noticeWhen/oneOf/1/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property '" + "value" + "'" };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        for (const key2 in data3) {
          if (!(key2 === "kind" || key2 === "value")) {
            const err16 = { instancePath: instancePath + "/when", schemaPath: "#/$defs/noticeWhen/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
        }
        if (data3.kind !== undefined) {
          if (data3.kind !== "equals") {
            const err17 = { instancePath: instancePath + "/when/kind", schemaPath: "#/$defs/noticeWhen/oneOf/1/properties/kind/const", keyword: "const", params: { allowedValue: "equals" }, message: "must be equal to constant" };
            if (vErrors === null) {
              vErrors = [err17];
            } else {
              vErrors.push(err17);
            }
            errors++;
          }
        }
        if (data3.value !== undefined) {
          let data6 = data3.value;
          if (typeof data6 !== "string" && !(typeof data6 == "number" && isFinite(data6)) && typeof data6 !== "boolean") {
            const err18 = { instancePath: instancePath + "/when/value", schemaPath: "#/$defs/noticeWhen/oneOf/1/properties/value/type", keyword: "type", params: { type: schema47.oneOf[1].properties.value.type }, message: "must be string,number,boolean" };
            if (vErrors === null) {
              vErrors = [err18];
            } else {
              vErrors.push(err18);
            }
            errors++;
          }
        }
      } else {
        const err19 = { instancePath: instancePath + "/when", schemaPath: "#/$defs/noticeWhen/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
      var _valid0 = _errs14 === errors;
      if (_valid0 && valid4) {
        valid4 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid4 = true;
          passing0 = 1;
          if (props0 !== true) {
            props0 = true;
          }
        }
        const _errs20 = errors;
        if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
          if (data3.kind === undefined) {
            const err20 = { instancePath: instancePath + "/when", schemaPath: "#/$defs/noticeWhen/oneOf/2/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
          if (data3.value === undefined) {
            const err21 = { instancePath: instancePath + "/when", schemaPath: "#/$defs/noticeWhen/oneOf/2/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property '" + "value" + "'" };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          }
          for (const key3 in data3) {
            if (!(key3 === "kind" || key3 === "value")) {
              const err22 = { instancePath: instancePath + "/when", schemaPath: "#/$defs/noticeWhen/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors++;
            }
          }
          if (data3.kind !== undefined) {
            if (data3.kind !== "not-equals") {
              const err23 = { instancePath: instancePath + "/when/kind", schemaPath: "#/$defs/noticeWhen/oneOf/2/properties/kind/const", keyword: "const", params: { allowedValue: "not-equals" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err23];
              } else {
                vErrors.push(err23);
              }
              errors++;
            }
          }
          if (data3.value !== undefined) {
            let data8 = data3.value;
            if (typeof data8 !== "string" && !(typeof data8 == "number" && isFinite(data8)) && typeof data8 !== "boolean") {
              const err24 = { instancePath: instancePath + "/when/value", schemaPath: "#/$defs/noticeWhen/oneOf/2/properties/value/type", keyword: "type", params: { type: schema47.oneOf[2].properties.value.type }, message: "must be string,number,boolean" };
              if (vErrors === null) {
                vErrors = [err24];
              } else {
                vErrors.push(err24);
              }
              errors++;
            }
          }
        } else {
          const err25 = { instancePath: instancePath + "/when", schemaPath: "#/$defs/noticeWhen/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        var _valid0 = _errs20 === errors;
        if (_valid0 && valid4) {
          valid4 = false;
          passing0 = [passing0, 2];
        } else {
          if (_valid0) {
            valid4 = true;
            passing0 = 2;
            if (props0 !== true) {
              props0 = true;
            }
          }
        }
      }
      if (!valid4) {
        const err26 = { instancePath: instancePath + "/when", schemaPath: "#/$defs/noticeWhen/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      } else {
        errors = _errs9;
        if (vErrors !== null) {
          if (_errs9) {
            vErrors.length = _errs9;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.message !== undefined) {
      let data9 = data.message;
      if (typeof data9 === "string") {
        if (!pattern6.test(data9)) {
          const err27 = { instancePath: instancePath + "/message", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
      } else {
        const err28 = { instancePath: instancePath + "/message", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.details !== undefined) {
      let data10 = data.details;
      if (typeof data10 === "string") {
        if (!pattern6.test(data10)) {
          const err29 = { instancePath: instancePath + "/details", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
      } else {
        const err30 = { instancePath: instancePath + "/details", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
    }
    if (data.suggestions !== undefined) {
      let data11 = data.suggestions;
      if (Array.isArray(data11)) {
        const len1 = data11.length;
        for (let i1 = 0;i1 < len1; i1++) {
          let data12 = data11[i1];
          if (typeof data12 === "string") {
            if (func2(data12) < 1) {
              const err31 = { instancePath: instancePath + "/suggestions/" + i1, schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err31];
              } else {
                vErrors.push(err31);
              }
              errors++;
            }
          } else {
            const err32 = { instancePath: instancePath + "/suggestions/" + i1, schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
        }
      } else {
        const err33 = { instancePath: instancePath + "/suggestions", schemaPath: "#/properties/suggestions/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err33];
        } else {
          vErrors.push(err33);
        }
        errors++;
      }
    }
  } else {
    const err34 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err34];
    } else {
      vErrors.push(err34);
    }
    errors++;
  }
  validate28.errors = vErrors;
  return errors === 0;
}
validate28.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate24(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate24.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.key === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "key" }, message: "must have required property '" + "key" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.label === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property '" + "label" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.key !== undefined) {
      let data0 = data.key;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err2 = { instancePath: instancePath + "/key", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
      } else {
        const err3 = { instancePath: instancePath + "/key", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.emitKey !== undefined) {
      let data1 = data.emitKey;
      if (typeof data1 === "string") {
        if (!pattern6.test(data1)) {
          const err4 = { instancePath: instancePath + "/emitKey", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/emitKey", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      let data2 = data.label;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err6 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      if (typeof data.description !== "string") {
        const err8 = { instancePath: instancePath + "/description", schemaPath: "#/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.required !== undefined) {
      if (typeof data.required !== "boolean") {
        const err9 = { instancePath: instancePath + "/required", schemaPath: "#/properties/required/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.visibleWhen !== undefined) {
      if (!validate25(data.visibleWhen, { instancePath: instancePath + "/visibleWhen", parentData: data, parentDataProperty: "visibleWhen", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
        errors = vErrors.length;
      }
    }
    if (data.enabledWhen !== undefined) {
      if (!validate25(data.enabledWhen, { instancePath: instancePath + "/enabledWhen", parentData: data, parentDataProperty: "enabledWhen", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
        errors = vErrors.length;
      }
    }
    if (data.group !== undefined) {
      let data7 = data.group;
      if (typeof data7 === "string") {
        if (func2(data7) < 1) {
          const err10 = { instancePath: instancePath + "/group", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/group", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.notices !== undefined) {
      let data8 = data.notices;
      if (Array.isArray(data8)) {
        const len0 = data8.length;
        for (let i0 = 0;i0 < len0; i0++) {
          if (!validate28(data8[i0], { instancePath: instancePath + "/notices/" + i0, parentData: data8, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err12 = { instancePath: instancePath + "/notices", schemaPath: "#/properties/notices/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.defaultEmission !== undefined) {
      let data10 = data.defaultEmission;
      if (typeof data10 !== "string") {
        const err13 = { instancePath: instancePath + "/defaultEmission", schemaPath: "#/properties/defaultEmission/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
      if (!(data10 === "emit" || data10 === "explicit-only")) {
        const err14 = { instancePath: instancePath + "/defaultEmission", schemaPath: "#/properties/defaultEmission/enum", keyword: "enum", params: { allowedValues: schema39.properties.defaultEmission.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
  } else {
    const err15 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err15];
    } else {
      vErrors.push(err15);
    }
    errors++;
  }
  validate24.errors = vErrors;
  return errors === 0;
}
validate24.evaluated = { props: { key: true, emitKey: true, label: true, description: true, required: true, visibleWhen: true, enabledWhen: true, group: true, notices: true, defaultEmission: true }, dynamicProps: false, dynamicItems: false };
var schema54 = { type: "object", required: ["kind", "values"], properties: { kind: { const: "value-map" }, values: { type: "object", propertyNames: { minLength: 1 }, additionalProperties: { $ref: "#/$defs/luaValue" } }, onUnknown: { type: "string", enum: ["omit", "emit-original", "warn-and-omit"] } }, additionalProperties: false };
var schema56 = { oneOf: [{ type: ["string", "number", "boolean", "null"] }, { type: "array", items: { $ref: "#/$defs/jsonValue" } }, { type: "object", additionalProperties: { $ref: "#/$defs/jsonValue" } }] };
var wrapper0 = { validate: validate34 };
function validate34(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate34.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (typeof data !== "string" && !(typeof data == "number" && isFinite(data)) && typeof data !== "boolean" && data !== null) {
    const err0 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: schema56.oneOf[0].type }, message: "must be string,number,boolean,null" };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
  }
  const _errs3 = errors;
  if (Array.isArray(data)) {
    const len0 = data.length;
    for (let i0 = 0;i0 < len0; i0++) {
      if (!wrapper0.validate(data[i0], { instancePath: instancePath + "/" + i0, parentData: data, parentDataProperty: i0, rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? wrapper0.validate.errors : vErrors.concat(wrapper0.validate.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err1 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "array" }, message: "must be array" };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
  }
  var _valid0 = _errs3 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      var items1 = true;
    }
    const _errs6 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      for (const key0 in data) {
        if (!wrapper0.validate(data[key0], { instancePath: instancePath + "/" + key0.replace(/~/g, "~0").replace(/\//g, "~1"), parentData: data, parentDataProperty: key0, rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? wrapper0.validate.errors : vErrors.concat(wrapper0.validate.errors);
          errors = vErrors.length;
        }
      }
    } else {
      const err2 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    var _valid0 = _errs6 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        var props2 = true;
      }
    }
  }
  if (!valid0) {
    const err3 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate34.errors = vErrors;
  evaluated0.props = props2;
  evaluated0.items = items1;
  return errors === 0;
}
validate34.evaluated = { dynamicProps: true, dynamicItems: true };
function validate33(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate33.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.value === undefined) {
      const err1 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property '" + "value" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "kind" || key0 === "value")) {
        const err2 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if (data.kind !== "json") {
        const err3 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/0/properties/kind/const", keyword: "const", params: { allowedValue: "json" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.value !== undefined) {
      if (!validate34(data.value, { instancePath: instancePath + "/value", parentData: data, parentDataProperty: "value", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate34.errors : vErrors.concat(validate34.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err4 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props1 = true;
  }
  const _errs6 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err5 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.lua === undefined) {
      const err6 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "lua" }, message: "must have required property '" + "lua" + "'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key1 in data) {
      if (!(key1 === "kind" || key1 === "lua")) {
        const err7 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if (data.kind !== "lua") {
        const err8 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/1/properties/kind/const", keyword: "const", params: { allowedValue: "lua" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.lua !== undefined) {
      let data3 = data.lua;
      if (typeof data3 === "string") {
        if (!pattern6.test(data3)) {
          const err9 = { instancePath: instancePath + "/lua", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = { instancePath: instancePath + "/lua", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
  } else {
    const err11 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  var _valid0 = _errs6 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props1 !== true) {
        props1 = true;
      }
    }
  }
  if (!valid0) {
    const err12 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate33.errors = vErrors;
  evaluated0.props = props1;
  return errors === 0;
}
validate33.evaluated = { dynamicProps: true, dynamicItems: false };
function validate32(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate32.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.values === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "values" }, message: "must have required property '" + "values" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "kind" || key0 === "values" || key0 === "onUnknown")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if (data.kind !== "value-map") {
        const err3 = { instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "value-map" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.values !== undefined) {
      let data1 = data.values;
      if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
        for (const key1 in data1) {
          const _errs5 = errors;
          if (typeof key1 === "string") {
            if (func2(key1) < 1) {
              const err4 = { instancePath: instancePath + "/values", schemaPath: "#/properties/values/propertyNames/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters", propertyName: key1 };
              if (vErrors === null) {
                vErrors = [err4];
              } else {
                vErrors.push(err4);
              }
              errors++;
            }
          }
          var valid1 = _errs5 === errors;
          if (!valid1) {
            const err5 = { instancePath: instancePath + "/values", schemaPath: "#/properties/values/propertyNames", keyword: "propertyNames", params: { propertyName: key1 }, message: "property name must be valid" };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors++;
          }
        }
        for (const key2 in data1) {
          if (!validate33(data1[key2], { instancePath: instancePath + "/values/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"), parentData: data1, parentDataProperty: key2, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate33.errors : vErrors.concat(validate33.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err6 = { instancePath: instancePath + "/values", schemaPath: "#/properties/values/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.onUnknown !== undefined) {
      let data3 = data.onUnknown;
      if (typeof data3 !== "string") {
        const err7 = { instancePath: instancePath + "/onUnknown", schemaPath: "#/properties/onUnknown/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
      if (!(data3 === "omit" || data3 === "emit-original" || data3 === "warn-and-omit")) {
        const err8 = { instancePath: instancePath + "/onUnknown", schemaPath: "#/properties/onUnknown/enum", keyword: "enum", params: { allowedValues: schema54.properties.onUnknown.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate32.errors = vErrors;
  return errors === 0;
}
validate32.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate31(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate31.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (!(key0 === "include" || key0 === "valueRule" || key0 === "stringRule")) {
        const err0 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.include !== undefined) {
      let data0 = data.include;
      const _errs4 = errors;
      let valid2 = false;
      let passing0 = null;
      const _errs5 = errors;
      if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
        if (data0.kind === undefined) {
          const err1 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf/0/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
        for (const key1 in data0) {
          if (!(key1 === "kind")) {
            const err2 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err2];
            } else {
              vErrors.push(err2);
            }
            errors++;
          }
        }
        if (data0.kind !== undefined) {
          if (data0.kind !== "always") {
            const err3 = { instancePath: instancePath + "/include/kind", schemaPath: "#/$defs/emitInclude/oneOf/0/properties/kind/const", keyword: "const", params: { allowedValue: "always" }, message: "must be equal to constant" };
            if (vErrors === null) {
              vErrors = [err3];
            } else {
              vErrors.push(err3);
            }
            errors++;
          }
        }
      } else {
        const err4 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
      var _valid0 = _errs5 === errors;
      if (_valid0) {
        valid2 = true;
        passing0 = 0;
        var props0 = true;
      }
      const _errs9 = errors;
      if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
        if (data0.kind === undefined) {
          const err5 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        for (const key2 in data0) {
          if (!(key2 === "kind")) {
            const err6 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
        }
        if (data0.kind !== undefined) {
          if (data0.kind !== "explicit-only") {
            const err7 = { instancePath: instancePath + "/include/kind", schemaPath: "#/$defs/emitInclude/oneOf/1/properties/kind/const", keyword: "const", params: { allowedValue: "explicit-only" }, message: "must be equal to constant" };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
      } else {
        const err8 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
      var _valid0 = _errs9 === errors;
      if (_valid0 && valid2) {
        valid2 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid2 = true;
          passing0 = 1;
          if (props0 !== true) {
            props0 = true;
          }
        }
        const _errs13 = errors;
        if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
          if (data0.kind === undefined) {
            const err9 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf/2/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
          for (const key3 in data0) {
            if (!(key3 === "kind")) {
              const err10 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
            }
          }
          if (data0.kind !== undefined) {
            if (data0.kind !== "non-default") {
              const err11 = { instancePath: instancePath + "/include/kind", schemaPath: "#/$defs/emitInclude/oneOf/2/properties/kind/const", keyword: "const", params: { allowedValue: "non-default" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
          }
        } else {
          const err12 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        var _valid0 = _errs13 === errors;
        if (_valid0 && valid2) {
          valid2 = false;
          passing0 = [passing0, 2];
        } else {
          if (_valid0) {
            valid2 = true;
            passing0 = 2;
            if (props0 !== true) {
              props0 = true;
            }
          }
          const _errs17 = errors;
          if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
            if (data0.kind === undefined) {
              const err13 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf/3/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
            }
            for (const key4 in data0) {
              if (!(key4 === "kind")) {
                const err14 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                if (vErrors === null) {
                  vErrors = [err14];
                } else {
                  vErrors.push(err14);
                }
                errors++;
              }
            }
            if (data0.kind !== undefined) {
              if (data0.kind !== "non-empty") {
                const err15 = { instancePath: instancePath + "/include/kind", schemaPath: "#/$defs/emitInclude/oneOf/3/properties/kind/const", keyword: "const", params: { allowedValue: "non-empty" }, message: "must be equal to constant" };
                if (vErrors === null) {
                  vErrors = [err15];
                } else {
                  vErrors.push(err15);
                }
                errors++;
              }
            }
          } else {
            const err16 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
          var _valid0 = _errs17 === errors;
          if (_valid0 && valid2) {
            valid2 = false;
            passing0 = [passing0, 3];
          } else {
            if (_valid0) {
              valid2 = true;
              passing0 = 3;
              if (props0 !== true) {
                props0 = true;
              }
            }
          }
        }
      }
      if (!valid2) {
        const err17 = { instancePath: instancePath + "/include", schemaPath: "#/$defs/emitInclude/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      } else {
        errors = _errs4;
        if (vErrors !== null) {
          if (_errs4) {
            vErrors.length = _errs4;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.valueRule !== undefined) {
      if (!validate32(data.valueRule, { instancePath: instancePath + "/valueRule", parentData: data, parentDataProperty: "valueRule", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate32.errors : vErrors.concat(validate32.errors);
        errors = vErrors.length;
      }
    }
    if (data.stringRule !== undefined) {
      let data6 = data.stringRule;
      if (data6 && typeof data6 == "object" && !Array.isArray(data6)) {
        if (data6.kind === undefined) {
          const err18 = { instancePath: instancePath + "/stringRule", schemaPath: "#/$defs/stringRule/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        for (const key5 in data6) {
          if (!(key5 === "kind" || key5 === "trim" || key5 === "omitWhenEmpty" || key5 === "expandWithVimFnExpand" || key5 === "warnWhenRelative")) {
            const err19 = { instancePath: instancePath + "/stringRule", schemaPath: "#/$defs/stringRule/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err19];
            } else {
              vErrors.push(err19);
            }
            errors++;
          }
        }
        if (data6.kind !== undefined) {
          if (data6.kind !== "path") {
            const err20 = { instancePath: instancePath + "/stringRule/kind", schemaPath: "#/$defs/stringRule/properties/kind/const", keyword: "const", params: { allowedValue: "path" }, message: "must be equal to constant" };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        }
        if (data6.trim !== undefined) {
          if (typeof data6.trim !== "boolean") {
            const err21 = { instancePath: instancePath + "/stringRule/trim", schemaPath: "#/$defs/stringRule/properties/trim/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          }
        }
        if (data6.omitWhenEmpty !== undefined) {
          if (typeof data6.omitWhenEmpty !== "boolean") {
            const err22 = { instancePath: instancePath + "/stringRule/omitWhenEmpty", schemaPath: "#/$defs/stringRule/properties/omitWhenEmpty/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
            if (vErrors === null) {
              vErrors = [err22];
            } else {
              vErrors.push(err22);
            }
            errors++;
          }
        }
        if (data6.expandWithVimFnExpand !== undefined) {
          if (typeof data6.expandWithVimFnExpand !== "boolean") {
            const err23 = { instancePath: instancePath + "/stringRule/expandWithVimFnExpand", schemaPath: "#/$defs/stringRule/properties/expandWithVimFnExpand/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
        if (data6.warnWhenRelative !== undefined) {
          if (typeof data6.warnWhenRelative !== "boolean") {
            const err24 = { instancePath: instancePath + "/stringRule/warnWhenRelative", schemaPath: "#/$defs/stringRule/properties/warnWhenRelative/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
            if (vErrors === null) {
              vErrors = [err24];
            } else {
              vErrors.push(err24);
            }
            errors++;
          }
        }
      } else {
        const err25 = { instancePath: instancePath + "/stringRule", schemaPath: "#/$defs/stringRule/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
    }
  } else {
    const err26 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err26];
    } else {
      vErrors.push(err26);
    }
    errors++;
  }
  validate31.errors = vErrors;
  return errors === 0;
}
validate31.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate44(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate44.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property '" + "value" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.label === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property '" + "label" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "value" || key0 === "label")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.value !== undefined) {
      let data0 = data.value;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err3 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      let data1 = data.label;
      if (typeof data1 === "string") {
        if (func2(data1) < 1) {
          const err5 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
  } else {
    const err7 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate44.errors = vErrors;
  return errors === 0;
}
validate44.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate48(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate48.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.itemType === undefined) {
      const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "itemType" }, message: "must have required property '" + "itemType" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "itemType")) {
        const err1 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.itemType !== undefined) {
      if (data.itemType !== "string") {
        const err2 = { instancePath: instancePath + "/itemType", schemaPath: "#/oneOf/0/properties/itemType/const", keyword: "const", params: { allowedValue: "string" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
  } else {
    const err3 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs5 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.itemType === undefined) {
      const err4 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "itemType" }, message: "must have required property '" + "itemType" + "'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key1 in data) {
      if (!(key1 === "itemType")) {
        const err5 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.itemType !== undefined) {
      if (data.itemType !== "number") {
        const err6 = { instancePath: instancePath + "/itemType", schemaPath: "#/oneOf/1/properties/itemType/const", keyword: "const", params: { allowedValue: "number" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
  } else {
    const err7 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  var _valid0 = _errs5 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs9 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.itemType === undefined) {
        const err8 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "itemType" }, message: "must have required property '" + "itemType" + "'" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
      if (data.options === undefined) {
        const err9 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "options" }, message: "must have required property '" + "options" + "'" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      for (const key2 in data) {
        if (!(key2 === "itemType" || key2 === "options")) {
          const err10 = { instancePath, schemaPath: "#/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      }
      if (data.itemType !== undefined) {
        if (data.itemType !== "select") {
          const err11 = { instancePath: instancePath + "/itemType", schemaPath: "#/oneOf/2/properties/itemType/const", keyword: "const", params: { allowedValue: "select" }, message: "must be equal to constant" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      }
      if (data.options !== undefined) {
        let data3 = data.options;
        if (Array.isArray(data3)) {
          if (data3.length < 1) {
            const err12 = { instancePath: instancePath + "/options", schemaPath: "#/oneOf/2/properties/options/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
          const len0 = data3.length;
          for (let i0 = 0;i0 < len0; i0++) {
            if (!validate44(data3[i0], { instancePath: instancePath + "/options/" + i0, parentData: data3, parentDataProperty: i0, rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate44.errors : vErrors.concat(validate44.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err13 = { instancePath: instancePath + "/options", schemaPath: "#/oneOf/2/properties/options/type", keyword: "type", params: { type: "array" }, message: "must be array" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      }
    } else {
      const err14 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    var _valid0 = _errs9 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
    }
  }
  if (!valid0) {
    const err15 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err15];
    } else {
      vErrors.push(err15);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate48.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate48.evaluated = { dynamicProps: true, dynamicItems: false };
var schema69 = { type: "object", required: ["kind", "sourceColumn", "values"], properties: { kind: { const: "value-by-column" }, sourceColumn: { $ref: "#/$defs/nonBlankString" }, values: { type: "object", propertyNames: { minLength: 1 }, additionalProperties: { type: "string" } }, fallback: { type: "string", enum: ["preserve", "empty", "column-default"] } }, additionalProperties: false };
function validate54(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate54.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.sourceColumn === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "sourceColumn" }, message: "must have required property '" + "sourceColumn" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.values === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "values" }, message: "must have required property '" + "values" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "kind" || key0 === "sourceColumn" || key0 === "values" || key0 === "fallback")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if (data.kind !== "value-by-column") {
        const err4 = { instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "value-by-column" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.sourceColumn !== undefined) {
      let data1 = data.sourceColumn;
      if (typeof data1 === "string") {
        if (!pattern6.test(data1)) {
          const err5 = { instancePath: instancePath + "/sourceColumn", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/sourceColumn", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.values !== undefined) {
      let data2 = data.values;
      if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
        for (const key1 in data2) {
          const _errs8 = errors;
          if (typeof key1 === "string") {
            if (func2(key1) < 1) {
              const err7 = { instancePath: instancePath + "/values", schemaPath: "#/properties/values/propertyNames/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters", propertyName: key1 };
              if (vErrors === null) {
                vErrors = [err7];
              } else {
                vErrors.push(err7);
              }
              errors++;
            }
          }
          var valid2 = _errs8 === errors;
          if (!valid2) {
            const err8 = { instancePath: instancePath + "/values", schemaPath: "#/properties/values/propertyNames", keyword: "propertyNames", params: { propertyName: key1 }, message: "property name must be valid" };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
          }
        }
        for (const key2 in data2) {
          if (typeof data2[key2] !== "string") {
            const err9 = { instancePath: instancePath + "/values/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/values/additionalProperties/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
      } else {
        const err10 = { instancePath: instancePath + "/values", schemaPath: "#/properties/values/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.fallback !== undefined) {
      let data4 = data.fallback;
      if (typeof data4 !== "string") {
        const err11 = { instancePath: instancePath + "/fallback", schemaPath: "#/properties/fallback/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      if (!(data4 === "preserve" || data4 === "empty" || data4 === "column-default")) {
        const err12 = { instancePath: instancePath + "/fallback", schemaPath: "#/properties/fallback/enum", keyword: "enum", params: { allowedValues: schema69.properties.fallback.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
  } else {
    const err13 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err13];
    } else {
      vErrors.push(err13);
    }
    errors++;
  }
  validate54.errors = vErrors;
  return errors === 0;
}
validate54.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate53(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate53.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.key === undefined) {
      const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "key" }, message: "must have required property '" + "key" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.label === undefined) {
      const err1 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property '" + "label" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.type === undefined) {
      const err2 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "key" || key0 === "label" || key0 === "type" || key0 === "default" || key0 === "autoFill")) {
        const err3 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.key !== undefined) {
      let data0 = data.key;
      if (typeof data0 === "string") {
        if (!pattern6.test(data0)) {
          const err4 = { instancePath: instancePath + "/key", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/key", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      let data1 = data.label;
      if (typeof data1 === "string") {
        if (!pattern6.test(data1)) {
          const err6 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      if (data.type !== "string") {
        const err8 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/0/properties/type/const", keyword: "const", params: { allowedValue: "string" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.default !== undefined) {
      if (typeof data.default !== "string") {
        const err9 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/0/properties/default/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.autoFill !== undefined) {
      if (!validate54(data.autoFill, { instancePath: instancePath + "/autoFill", parentData: data, parentDataProperty: "autoFill", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate54.errors : vErrors.concat(validate54.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err10 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs14 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.key === undefined) {
      const err11 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "key" }, message: "must have required property '" + "key" + "'" };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.label === undefined) {
      const err12 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property '" + "label" + "'" };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.type === undefined) {
      const err13 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.options === undefined) {
      const err14 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "options" }, message: "must have required property '" + "options" + "'" };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    for (const key1 in data) {
      if (!(key1 === "key" || key1 === "label" || key1 === "type" || key1 === "default" || key1 === "autoFill" || key1 === "options")) {
        const err15 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.key !== undefined) {
      let data5 = data.key;
      if (typeof data5 === "string") {
        if (!pattern6.test(data5)) {
          const err16 = { instancePath: instancePath + "/key", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = { instancePath: instancePath + "/key", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      let data6 = data.label;
      if (typeof data6 === "string") {
        if (!pattern6.test(data6)) {
          const err18 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      } else {
        const err19 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      if (data.type !== "select") {
        const err20 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/1/properties/type/const", keyword: "const", params: { allowedValue: "select" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.default !== undefined) {
      if (typeof data.default !== "string") {
        const err21 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/1/properties/default/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.autoFill !== undefined) {
      if (!validate54(data.autoFill, { instancePath: instancePath + "/autoFill", parentData: data, parentDataProperty: "autoFill", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate54.errors : vErrors.concat(validate54.errors);
        errors = vErrors.length;
      }
    }
    if (data.options !== undefined) {
      let data10 = data.options;
      if (Array.isArray(data10)) {
        if (data10.length < 1) {
          const err22 = { instancePath: instancePath + "/options", schemaPath: "#/oneOf/1/properties/options/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        const len0 = data10.length;
        for (let i0 = 0;i0 < len0; i0++) {
          if (!validate44(data10[i0], { instancePath: instancePath + "/options/" + i0, parentData: data10, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate44.errors : vErrors.concat(validate44.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err23 = { instancePath: instancePath + "/options", schemaPath: "#/oneOf/1/properties/options/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
  } else {
    const err24 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err24];
    } else {
      vErrors.push(err24);
    }
    errors++;
  }
  var _valid0 = _errs14 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
  }
  if (!valid0) {
    const err25 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err25];
    } else {
      vErrors.push(err25);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate53.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate53.evaluated = { dynamicProps: true, dynamicItems: false };
function validate59(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate59.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.targetKey === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "targetKey" }, message: "must have required property '" + "targetKey" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.keyColumn === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "keyColumn" }, message: "must have required property '" + "keyColumn" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.valueColumn === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "valueColumn" }, message: "must have required property '" + "valueColumn" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.valueTemplate === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "valueTemplate" }, message: "must have required property '" + "valueTemplate" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "targetKey" || key0 === "keyColumn" || key0 === "valueColumn" || key0 === "valueTemplate" || key0 === "outputKeyMap")) {
        const err4 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.targetKey !== undefined) {
      let data0 = data.targetKey;
      if (typeof data0 === "string") {
        if (!pattern6.test(data0)) {
          const err5 = { instancePath: instancePath + "/targetKey", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/targetKey", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.keyColumn !== undefined) {
      let data1 = data.keyColumn;
      if (typeof data1 === "string") {
        if (!pattern6.test(data1)) {
          const err7 = { instancePath: instancePath + "/keyColumn", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/keyColumn", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.valueColumn !== undefined) {
      let data2 = data.valueColumn;
      if (typeof data2 === "string") {
        if (!pattern6.test(data2)) {
          const err9 = { instancePath: instancePath + "/valueColumn", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = { instancePath: instancePath + "/valueColumn", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.valueTemplate !== undefined) {
      let data3 = data.valueTemplate;
      if (typeof data3 === "string") {
        if (!pattern6.test(data3)) {
          const err11 = { instancePath: instancePath + "/valueTemplate", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = { instancePath: instancePath + "/valueTemplate", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.outputKeyMap !== undefined) {
      let data4 = data.outputKeyMap;
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
        for (const key1 in data4) {
          const _errs16 = errors;
          if (typeof key1 === "string") {
            if (func2(key1) < 1) {
              const err13 = { instancePath: instancePath + "/outputKeyMap", schemaPath: "#/properties/outputKeyMap/propertyNames/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters", propertyName: key1 };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
            }
          }
          var valid5 = _errs16 === errors;
          if (!valid5) {
            const err14 = { instancePath: instancePath + "/outputKeyMap", schemaPath: "#/properties/outputKeyMap/propertyNames", keyword: "propertyNames", params: { propertyName: key1 }, message: "property name must be valid" };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
        }
        for (const key2 in data4) {
          let data5 = data4[key2];
          if (typeof data5 === "string") {
            if (!pattern6.test(data5)) {
              const err15 = { instancePath: instancePath + "/outputKeyMap/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
              if (vErrors === null) {
                vErrors = [err15];
              } else {
                vErrors.push(err15);
              }
              errors++;
            }
          } else {
            const err16 = { instancePath: instancePath + "/outputKeyMap/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
        }
      } else {
        const err17 = { instancePath: instancePath + "/outputKeyMap", schemaPath: "#/properties/outputKeyMap/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
  } else {
    const err18 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err18];
    } else {
      vErrors.push(err18);
    }
    errors++;
  }
  validate59.errors = vErrors;
  return errors === 0;
}
validate59.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate61(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate61.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.column === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "column" }, message: "must have required property '" + "column" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.values === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "values" }, message: "must have required property '" + "values" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.severity === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "severity" }, message: "must have required property '" + "severity" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.message === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "message" }, message: "must have required property '" + "message" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "column" || key0 === "values" || key0 === "severity" || key0 === "message")) {
        const err4 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.column !== undefined) {
      let data0 = data.column;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err5 = { instancePath: instancePath + "/column", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/column", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.values !== undefined) {
      let data1 = data.values;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0;i0 < len0; i0++) {
          let data2 = data1[i0];
          if (typeof data2 === "string") {
            if (func2(data2) < 1) {
              const err7 = { instancePath: instancePath + "/values/" + i0, schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err7];
              } else {
                vErrors.push(err7);
              }
              errors++;
            }
          } else {
            const err8 = { instancePath: instancePath + "/values/" + i0, schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
          }
        }
      } else {
        const err9 = { instancePath: instancePath + "/values", schemaPath: "#/properties/values/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.severity !== undefined) {
      if (data.severity !== "warning") {
        const err10 = { instancePath: instancePath + "/severity", schemaPath: "#/properties/severity/const", keyword: "const", params: { allowedValue: "warning" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.message !== undefined) {
      let data4 = data.message;
      if (typeof data4 === "string") {
        if (func2(data4) < 1) {
          const err11 = { instancePath: instancePath + "/message", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = { instancePath: instancePath + "/message", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
  } else {
    const err13 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err13];
    } else {
      vErrors.push(err13);
    }
    errors++;
  }
  validate61.errors = vErrors;
  return errors === 0;
}
validate61.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate72(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate72.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.name === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "name" }, message: "must have required property '" + "name" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.label === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property '" + "label" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "name" || key0 === "label" || key0 === "description" || key0 === "isTerminal")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.name !== undefined) {
      let data0 = data.name;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err3 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      let data1 = data.label;
      if (typeof data1 === "string") {
        if (func2(data1) < 1) {
          const err5 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      if (typeof data.description !== "string") {
        const err7 = { instancePath: instancePath + "/description", schemaPath: "#/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.isTerminal !== undefined) {
      if (typeof data.isTerminal !== "boolean") {
        const err8 = { instancePath: instancePath + "/isTerminal", schemaPath: "#/properties/isTerminal/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate72.errors = vErrors;
  return errors === 0;
}
validate72.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate74(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate74.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property '" + "id" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.label === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property '" + "label" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.mappings === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "mappings" }, message: "must have required property '" + "mappings" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "label" || key0 === "description" || key0 === "mappings")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== undefined) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err4 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      let data1 = data.label;
      if (typeof data1 === "string") {
        if (func2(data1) < 1) {
          const err6 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      if (typeof data.description !== "string") {
        const err8 = { instancePath: instancePath + "/description", schemaPath: "#/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.mappings !== undefined) {
      let data3 = data.mappings;
      if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
        for (const key1 in data3) {
          let data4 = data3[key1];
          if (Array.isArray(data4)) {
            const len0 = data4.length;
            for (let i0 = 0;i0 < len0; i0++) {
              let data5 = data4[i0];
              if (typeof data5 === "string") {
                if (func2(data5) < 1) {
                  const err9 = { instancePath: instancePath + "/mappings/" + key1.replace(/~/g, "~0").replace(/\//g, "~1") + "/" + i0, schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err9];
                  } else {
                    vErrors.push(err9);
                  }
                  errors++;
                }
              } else {
                const err10 = { instancePath: instancePath + "/mappings/" + key1.replace(/~/g, "~0").replace(/\//g, "~1") + "/" + i0, schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err10];
                } else {
                  vErrors.push(err10);
                }
                errors++;
              }
            }
          } else {
            const err11 = { instancePath: instancePath + "/mappings/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/mappings/additionalProperties/type", keyword: "type", params: { type: "array" }, message: "must be array" };
            if (vErrors === null) {
              vErrors = [err11];
            } else {
              vErrors.push(err11);
            }
            errors++;
          }
        }
      } else {
        const err12 = { instancePath: instancePath + "/mappings", schemaPath: "#/properties/mappings/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
  } else {
    const err13 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err13];
    } else {
      vErrors.push(err13);
    }
    errors++;
  }
  validate74.errors = vErrors;
  return errors === 0;
}
validate74.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var wrapper2 = { validate: validate23 };
function validate23(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.type === undefined) {
      const err0 = { instancePath, schemaPath: "#/oneOf/0/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type !== undefined) {
      if (data.type !== "string") {
        const err1 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/0/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "string" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.default !== undefined) {
      if (typeof data.default !== "string") {
        const err2 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/0/allOf/1/properties/default/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.validation !== undefined) {
      let data2 = data.validation;
      if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
        for (const key0 in data2) {
          if (!(key0 === "minLength" || key0 === "maxLength" || key0 === "pattern")) {
            const err3 = { instancePath: instancePath + "/validation", schemaPath: "#/$defs/stringValidation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err3];
            } else {
              vErrors.push(err3);
            }
            errors++;
          }
        }
        if (data2.minLength !== undefined) {
          let data3 = data2.minLength;
          if (!(typeof data3 == "number" && isFinite(data3))) {
            const err4 = { instancePath: instancePath + "/validation/minLength", schemaPath: "#/$defs/stringValidation/properties/minLength/type", keyword: "type", params: { type: "number" }, message: "must be number" };
            if (vErrors === null) {
              vErrors = [err4];
            } else {
              vErrors.push(err4);
            }
            errors++;
          }
        }
        if (data2.maxLength !== undefined) {
          let data4 = data2.maxLength;
          if (!(typeof data4 == "number" && isFinite(data4))) {
            const err5 = { instancePath: instancePath + "/validation/maxLength", schemaPath: "#/$defs/stringValidation/properties/maxLength/type", keyword: "type", params: { type: "number" }, message: "must be number" };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors++;
          }
        }
        if (data2.pattern !== undefined) {
          if (typeof data2.pattern !== "string") {
            const err6 = { instancePath: instancePath + "/validation/pattern", schemaPath: "#/$defs/stringValidation/properties/pattern/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
        }
      } else {
        const err7 = { instancePath: instancePath + "/validation", schemaPath: "#/$defs/stringValidation/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.uiHint !== undefined) {
      let data6 = data.uiHint;
      if (typeof data6 !== "string") {
        const err8 = { instancePath: instancePath + "/uiHint", schemaPath: "#/oneOf/0/allOf/1/properties/uiHint/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
      if (!(data6 === "input" || data6 === "textarea")) {
        const err9 = { instancePath: instancePath + "/uiHint", schemaPath: "#/oneOf/0/allOf/1/properties/uiHint/enum", keyword: "enum", params: { allowedValues: schema38.oneOf[0].allOf[1].properties.uiHint.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.emit !== undefined) {
      if (!validate31(data.emit, { instancePath: instancePath + "/emit", parentData: data, parentDataProperty: "emit", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err10 = { instancePath, schemaPath: "#/oneOf/0/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key1 in data) {
      if (key1 !== "type" && key1 !== "default" && key1 !== "validation" && key1 !== "uiHint" && key1 !== "emit" && key1 !== "key" && key1 !== "emitKey" && key1 !== "label" && key1 !== "description" && key1 !== "required" && key1 !== "visibleWhen" && key1 !== "enabledWhen" && key1 !== "group" && key1 !== "notices" && key1 !== "defaultEmission") {
        const err11 = { instancePath, schemaPath: "#/oneOf/0/unevaluatedProperties", keyword: "unevaluatedProperties", params: { unevaluatedProperty: key1 }, message: "must NOT have unevaluated properties" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
  } else {
    const err12 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs23 = errors;
  if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.type === undefined) {
      const err13 = { instancePath, schemaPath: "#/oneOf/1/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.type !== undefined) {
      if (data.type !== "number") {
        const err14 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/1/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "number" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.default !== undefined) {
      let data9 = data.default;
      if (!(typeof data9 == "number" && isFinite(data9))) {
        const err15 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/1/allOf/1/properties/default/type", keyword: "type", params: { type: "number" }, message: "must be number" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.validation !== undefined) {
      let data10 = data.validation;
      if (data10 && typeof data10 == "object" && !Array.isArray(data10)) {
        for (const key2 in data10) {
          if (!(key2 === "min" || key2 === "max" || key2 === "step" || key2 === "integer")) {
            const err16 = { instancePath: instancePath + "/validation", schemaPath: "#/$defs/numberValidation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
        }
        if (data10.min !== undefined) {
          let data11 = data10.min;
          if (!(typeof data11 == "number" && isFinite(data11))) {
            const err17 = { instancePath: instancePath + "/validation/min", schemaPath: "#/$defs/numberValidation/properties/min/type", keyword: "type", params: { type: "number" }, message: "must be number" };
            if (vErrors === null) {
              vErrors = [err17];
            } else {
              vErrors.push(err17);
            }
            errors++;
          }
        }
        if (data10.max !== undefined) {
          let data12 = data10.max;
          if (!(typeof data12 == "number" && isFinite(data12))) {
            const err18 = { instancePath: instancePath + "/validation/max", schemaPath: "#/$defs/numberValidation/properties/max/type", keyword: "type", params: { type: "number" }, message: "must be number" };
            if (vErrors === null) {
              vErrors = [err18];
            } else {
              vErrors.push(err18);
            }
            errors++;
          }
        }
        if (data10.step !== undefined) {
          let data13 = data10.step;
          if (!(typeof data13 == "number" && isFinite(data13))) {
            const err19 = { instancePath: instancePath + "/validation/step", schemaPath: "#/$defs/numberValidation/properties/step/type", keyword: "type", params: { type: "number" }, message: "must be number" };
            if (vErrors === null) {
              vErrors = [err19];
            } else {
              vErrors.push(err19);
            }
            errors++;
          }
        }
        if (data10.integer !== undefined) {
          if (typeof data10.integer !== "boolean") {
            const err20 = { instancePath: instancePath + "/validation/integer", schemaPath: "#/$defs/numberValidation/properties/integer/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        }
      } else {
        const err21 = { instancePath: instancePath + "/validation", schemaPath: "#/$defs/numberValidation/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.emit !== undefined) {
      if (!validate31(data.emit, { instancePath: instancePath + "/emit", parentData: data, parentDataProperty: "emit", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err22 = { instancePath, schemaPath: "#/oneOf/1/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err22];
    } else {
      vErrors.push(err22);
    }
    errors++;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key3 in data) {
      if (key3 !== "type" && key3 !== "default" && key3 !== "validation" && key3 !== "emit" && key3 !== "key" && key3 !== "emitKey" && key3 !== "label" && key3 !== "description" && key3 !== "required" && key3 !== "visibleWhen" && key3 !== "enabledWhen" && key3 !== "group" && key3 !== "notices" && key3 !== "defaultEmission") {
        const err23 = { instancePath, schemaPath: "#/oneOf/1/unevaluatedProperties", keyword: "unevaluatedProperties", params: { unevaluatedProperty: key3 }, message: "must NOT have unevaluated properties" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
  } else {
    const err24 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err24];
    } else {
      vErrors.push(err24);
    }
    errors++;
  }
  var _valid0 = _errs23 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs45 = errors;
    if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
      vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
      errors = vErrors.length;
    }
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.type === undefined) {
        const err25 = { instancePath, schemaPath: "#/oneOf/2/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
      if (data.type !== undefined) {
        if (data.type !== "boolean") {
          const err26 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/2/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "boolean" }, message: "must be equal to constant" };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
      }
      if (data.default !== undefined) {
        if (typeof data.default !== "boolean") {
          const err27 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/2/allOf/1/properties/default/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
      }
      if (data.emit !== undefined) {
        if (!validate31(data.emit, { instancePath: instancePath + "/emit", parentData: data, parentDataProperty: "emit", rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
          errors = vErrors.length;
        }
      }
    } else {
      const err28 = { instancePath, schemaPath: "#/oneOf/2/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err28];
      } else {
        vErrors.push(err28);
      }
      errors++;
    }
    if (data && typeof data == "object" && !Array.isArray(data)) {
      for (const key4 in data) {
        if (key4 !== "type" && key4 !== "default" && key4 !== "emit" && key4 !== "key" && key4 !== "emitKey" && key4 !== "label" && key4 !== "description" && key4 !== "required" && key4 !== "visibleWhen" && key4 !== "enabledWhen" && key4 !== "group" && key4 !== "notices" && key4 !== "defaultEmission") {
          const err29 = { instancePath, schemaPath: "#/oneOf/2/unevaluatedProperties", keyword: "unevaluatedProperties", params: { unevaluatedProperty: key4 }, message: "must NOT have unevaluated properties" };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
      }
    } else {
      const err30 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err30];
      } else {
        vErrors.push(err30);
      }
      errors++;
    }
    var _valid0 = _errs45 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs55 = errors;
      if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
        errors = vErrors.length;
      }
      const _errs61 = errors;
      let valid13 = true;
      const _errs62 = errors;
      if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing0;
        if (data.multi === undefined && (missing0 = "multi")) {
          const err31 = {};
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        } else {
          if (data.multi !== undefined) {
            if (data.multi !== true) {
              const err32 = {};
              if (vErrors === null) {
                vErrors = [err32];
              } else {
                vErrors.push(err32);
              }
              errors++;
            }
          }
        }
      }
      var _valid1 = _errs62 === errors;
      errors = _errs61;
      if (vErrors !== null) {
        if (_errs61) {
          vErrors.length = _errs61;
        } else {
          vErrors = null;
        }
      }
      let ifClause0;
      if (_valid1) {
        const _errs64 = errors;
        if (data && typeof data == "object" && !Array.isArray(data)) {
          if (data.default !== undefined) {
            let data20 = data.default;
            if (Array.isArray(data20)) {
              const len0 = data20.length;
              for (let i0 = 0;i0 < len0; i0++) {
                if (typeof data20[i0] !== "string") {
                  const err33 = { instancePath: instancePath + "/default/" + i0, schemaPath: "#/oneOf/3/allOf/1/allOf/0/then/properties/default/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                  if (vErrors === null) {
                    vErrors = [err33];
                  } else {
                    vErrors.push(err33);
                  }
                  errors++;
                }
              }
            } else {
              const err34 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/3/allOf/1/allOf/0/then/properties/default/type", keyword: "type", params: { type: "array" }, message: "must be array" };
              if (vErrors === null) {
                vErrors = [err34];
              } else {
                vErrors.push(err34);
              }
              errors++;
            }
          }
        }
        var _valid1 = _errs64 === errors;
        valid13 = _valid1;
        if (valid13) {
          var props1 = {};
          props1.default = true;
          props1.multi = true;
        }
        ifClause0 = "then";
      } else {
        const _errs69 = errors;
        if (data && typeof data == "object" && !Array.isArray(data)) {
          if (data.multi !== undefined) {
            if (data.multi !== false) {
              const err35 = { instancePath: instancePath + "/multi", schemaPath: "#/oneOf/3/allOf/1/allOf/0/else/properties/multi/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors++;
            }
          }
          if (data.default !== undefined) {
            if (typeof data.default !== "string") {
              const err36 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/3/allOf/1/allOf/0/else/properties/default/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
            }
          }
        }
        var _valid1 = _errs69 === errors;
        valid13 = _valid1;
        if (valid13) {
          if (props1 !== true) {
            props1 = props1 || {};
            props1.multi = true;
            props1.default = true;
          }
        }
        ifClause0 = "else";
      }
      if (!valid13) {
        const err37 = { instancePath, schemaPath: "#/oneOf/3/allOf/1/allOf/0/if", keyword: "if", params: { failingKeyword: ifClause0 }, message: 'must match "' + ifClause0 + '" schema' };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.type === undefined) {
          const err38 = { instancePath, schemaPath: "#/oneOf/3/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
          if (vErrors === null) {
            vErrors = [err38];
          } else {
            vErrors.push(err38);
          }
          errors++;
        }
        if (data.options === undefined) {
          const err39 = { instancePath, schemaPath: "#/oneOf/3/allOf/1/required", keyword: "required", params: { missingProperty: "options" }, message: "must have required property '" + "options" + "'" };
          if (vErrors === null) {
            vErrors = [err39];
          } else {
            vErrors.push(err39);
          }
          errors++;
        }
        if (props1 !== true) {
          props1 = props1 || {};
          props1.type = true;
          props1.options = true;
          props1.multi = true;
          props1.default = true;
          props1.emit = true;
        }
        if (data.type !== undefined) {
          if (data.type !== "select") {
            const err40 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/3/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "select" }, message: "must be equal to constant" };
            if (vErrors === null) {
              vErrors = [err40];
            } else {
              vErrors.push(err40);
            }
            errors++;
          }
        }
        if (data.options !== undefined) {
          let data25 = data.options;
          if (Array.isArray(data25)) {
            if (data25.length < 1) {
              const err41 = { instancePath: instancePath + "/options", schemaPath: "#/oneOf/3/allOf/1/properties/options/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
              if (vErrors === null) {
                vErrors = [err41];
              } else {
                vErrors.push(err41);
              }
              errors++;
            }
            const len1 = data25.length;
            for (let i1 = 0;i1 < len1; i1++) {
              if (!validate44(data25[i1], { instancePath: instancePath + "/options/" + i1, parentData: data25, parentDataProperty: i1, rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate44.errors : vErrors.concat(validate44.errors);
                errors = vErrors.length;
              }
            }
          } else {
            const err42 = { instancePath: instancePath + "/options", schemaPath: "#/oneOf/3/allOf/1/properties/options/type", keyword: "type", params: { type: "array" }, message: "must be array" };
            if (vErrors === null) {
              vErrors = [err42];
            } else {
              vErrors.push(err42);
            }
            errors++;
          }
        }
        if (data.multi !== undefined) {
          if (typeof data.multi !== "boolean") {
            const err43 = { instancePath: instancePath + "/multi", schemaPath: "#/oneOf/3/allOf/1/properties/multi/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
            if (vErrors === null) {
              vErrors = [err43];
            } else {
              vErrors.push(err43);
            }
            errors++;
          }
        }
        if (data.default !== undefined) {
          let data28 = data.default;
          const _errs80 = errors;
          let valid22 = false;
          let passing1 = null;
          const _errs81 = errors;
          if (typeof data28 !== "string") {
            const err44 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/3/allOf/1/properties/default/oneOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err44];
            } else {
              vErrors.push(err44);
            }
            errors++;
          }
          var _valid2 = _errs81 === errors;
          if (_valid2) {
            valid22 = true;
            passing1 = 0;
          }
          const _errs83 = errors;
          if (Array.isArray(data28)) {
            const len2 = data28.length;
            for (let i2 = 0;i2 < len2; i2++) {
              if (typeof data28[i2] !== "string") {
                const err45 = { instancePath: instancePath + "/default/" + i2, schemaPath: "#/oneOf/3/allOf/1/properties/default/oneOf/1/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err45];
                } else {
                  vErrors.push(err45);
                }
                errors++;
              }
            }
          } else {
            const err46 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/3/allOf/1/properties/default/oneOf/1/type", keyword: "type", params: { type: "array" }, message: "must be array" };
            if (vErrors === null) {
              vErrors = [err46];
            } else {
              vErrors.push(err46);
            }
            errors++;
          }
          var _valid2 = _errs83 === errors;
          if (_valid2 && valid22) {
            valid22 = false;
            passing1 = [passing1, 1];
          } else {
            if (_valid2) {
              valid22 = true;
              passing1 = 1;
            }
          }
          if (!valid22) {
            const err47 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/3/allOf/1/properties/default/oneOf", keyword: "oneOf", params: { passingSchemas: passing1 }, message: "must match exactly one schema in oneOf" };
            if (vErrors === null) {
              vErrors = [err47];
            } else {
              vErrors.push(err47);
            }
            errors++;
          } else {
            errors = _errs80;
            if (vErrors !== null) {
              if (_errs80) {
                vErrors.length = _errs80;
              } else {
                vErrors = null;
              }
            }
          }
        }
        if (data.emit !== undefined) {
          if (!validate31(data.emit, { instancePath: instancePath + "/emit", parentData: data, parentDataProperty: "emit", rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err48 = { instancePath, schemaPath: "#/oneOf/3/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err48];
        } else {
          vErrors.push(err48);
        }
        errors++;
      }
      if (props1 !== true) {
        props1 = props1 || {};
        props1.key = true;
        props1.emitKey = true;
        props1.label = true;
        props1.description = true;
        props1.required = true;
        props1.visibleWhen = true;
        props1.enabledWhen = true;
        props1.group = true;
        props1.notices = true;
        props1.defaultEmission = true;
      }
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (props1 !== true) {
          for (const key5 in data) {
            if (!props1 || !props1[key5]) {
              const err49 = { instancePath, schemaPath: "#/oneOf/3/unevaluatedProperties", keyword: "unevaluatedProperties", params: { unevaluatedProperty: key5 }, message: "must NOT have unevaluated properties" };
              if (vErrors === null) {
                vErrors = [err49];
              } else {
                vErrors.push(err49);
              }
              errors++;
            }
          }
        }
      } else {
        const err50 = { instancePath, schemaPath: "#/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err50];
        } else {
          vErrors.push(err50);
        }
        errors++;
      }
      var _valid0 = _errs55 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = true;
          }
        }
        const _errs89 = errors;
        if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
          errors = vErrors.length;
        }
        if (data && typeof data == "object" && !Array.isArray(data)) {
          if (data.type === undefined) {
            const err51 = { instancePath, schemaPath: "#/oneOf/4/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
            if (vErrors === null) {
              vErrors = [err51];
            } else {
              vErrors.push(err51);
            }
            errors++;
          }
          if (data.items === undefined) {
            const err52 = { instancePath, schemaPath: "#/oneOf/4/allOf/1/required", keyword: "required", params: { missingProperty: "items" }, message: "must have required property '" + "items" + "'" };
            if (vErrors === null) {
              vErrors = [err52];
            } else {
              vErrors.push(err52);
            }
            errors++;
          }
          if (data.type !== undefined) {
            if (data.type !== "array") {
              const err53 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/4/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "array" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err53];
              } else {
                vErrors.push(err53);
              }
              errors++;
            }
          }
          if (data.default !== undefined) {
            if (!Array.isArray(data.default)) {
              const err54 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/4/allOf/1/properties/default/type", keyword: "type", params: { type: "array" }, message: "must be array" };
              if (vErrors === null) {
                vErrors = [err54];
              } else {
                vErrors.push(err54);
              }
              errors++;
            }
          }
          if (data.items !== undefined) {
            if (!validate48(data.items, { instancePath: instancePath + "/items", parentData: data, parentDataProperty: "items", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate48.errors : vErrors.concat(validate48.errors);
              errors = vErrors.length;
            }
          }
          if (data.validation !== undefined) {
            let data34 = data.validation;
            if (data34 && typeof data34 == "object" && !Array.isArray(data34)) {
              for (const key6 in data34) {
                if (!(key6 === "minItems" || key6 === "maxItems" || key6 === "uniqueItems")) {
                  const err55 = { instancePath: instancePath + "/validation", schemaPath: "#/$defs/arrayValidation/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                  if (vErrors === null) {
                    vErrors = [err55];
                  } else {
                    vErrors.push(err55);
                  }
                  errors++;
                }
              }
              if (data34.minItems !== undefined) {
                let data35 = data34.minItems;
                if (!(typeof data35 == "number" && isFinite(data35))) {
                  const err56 = { instancePath: instancePath + "/validation/minItems", schemaPath: "#/$defs/arrayValidation/properties/minItems/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                  if (vErrors === null) {
                    vErrors = [err56];
                  } else {
                    vErrors.push(err56);
                  }
                  errors++;
                }
              }
              if (data34.maxItems !== undefined) {
                let data36 = data34.maxItems;
                if (!(typeof data36 == "number" && isFinite(data36))) {
                  const err57 = { instancePath: instancePath + "/validation/maxItems", schemaPath: "#/$defs/arrayValidation/properties/maxItems/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                  if (vErrors === null) {
                    vErrors = [err57];
                  } else {
                    vErrors.push(err57);
                  }
                  errors++;
                }
              }
              if (data34.uniqueItems !== undefined) {
                if (typeof data34.uniqueItems !== "boolean") {
                  const err58 = { instancePath: instancePath + "/validation/uniqueItems", schemaPath: "#/$defs/arrayValidation/properties/uniqueItems/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                  if (vErrors === null) {
                    vErrors = [err58];
                  } else {
                    vErrors.push(err58);
                  }
                  errors++;
                }
              }
            } else {
              const err59 = { instancePath: instancePath + "/validation", schemaPath: "#/$defs/arrayValidation/type", keyword: "type", params: { type: "object" }, message: "must be object" };
              if (vErrors === null) {
                vErrors = [err59];
              } else {
                vErrors.push(err59);
              }
              errors++;
            }
          }
          if (data.emit !== undefined) {
            if (!validate31(data.emit, { instancePath: instancePath + "/emit", parentData: data, parentDataProperty: "emit", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err60 = { instancePath, schemaPath: "#/oneOf/4/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err60];
          } else {
            vErrors.push(err60);
          }
          errors++;
        }
        if (data && typeof data == "object" && !Array.isArray(data)) {
          for (const key7 in data) {
            if (key7 !== "type" && key7 !== "default" && key7 !== "items" && key7 !== "validation" && key7 !== "emit" && key7 !== "key" && key7 !== "emitKey" && key7 !== "label" && key7 !== "description" && key7 !== "required" && key7 !== "visibleWhen" && key7 !== "enabledWhen" && key7 !== "group" && key7 !== "notices" && key7 !== "defaultEmission") {
              const err61 = { instancePath, schemaPath: "#/oneOf/4/unevaluatedProperties", keyword: "unevaluatedProperties", params: { unevaluatedProperty: key7 }, message: "must NOT have unevaluated properties" };
              if (vErrors === null) {
                vErrors = [err61];
              } else {
                vErrors.push(err61);
              }
              errors++;
            }
          }
        } else {
          const err62 = { instancePath, schemaPath: "#/oneOf/4/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err62];
          } else {
            vErrors.push(err62);
          }
          errors++;
        }
        var _valid0 = _errs89 === errors;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
            if (props0 !== true) {
              props0 = true;
            }
          }
          const _errs110 = errors;
          if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
            errors = vErrors.length;
          }
          if (data && typeof data == "object" && !Array.isArray(data)) {
            if (data.type === undefined) {
              const err63 = { instancePath, schemaPath: "#/oneOf/5/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
              if (vErrors === null) {
                vErrors = [err63];
              } else {
                vErrors.push(err63);
              }
              errors++;
            }
            if (data.columns === undefined) {
              const err64 = { instancePath, schemaPath: "#/oneOf/5/allOf/1/required", keyword: "required", params: { missingProperty: "columns" }, message: "must have required property '" + "columns" + "'" };
              if (vErrors === null) {
                vErrors = [err64];
              } else {
                vErrors.push(err64);
              }
              errors++;
            }
            if (data.emit === undefined) {
              const err65 = { instancePath, schemaPath: "#/oneOf/5/allOf/1/required", keyword: "required", params: { missingProperty: "emit" }, message: "must have required property '" + "emit" + "'" };
              if (vErrors === null) {
                vErrors = [err65];
              } else {
                vErrors.push(err65);
              }
              errors++;
            }
            if (data.type !== undefined) {
              if (data.type !== "mapping-table") {
                const err66 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/5/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "mapping-table" }, message: "must be equal to constant" };
                if (vErrors === null) {
                  vErrors = [err66];
                } else {
                  vErrors.push(err66);
                }
                errors++;
              }
            }
            if (data.default !== undefined) {
              let data40 = data.default;
              if (Array.isArray(data40)) {
                const len3 = data40.length;
                for (let i3 = 0;i3 < len3; i3++) {
                  let data41 = data40[i3];
                  if (data41 && typeof data41 == "object" && !Array.isArray(data41)) {
                    for (const key8 in data41) {
                      if (typeof data41[key8] !== "string") {
                        const err67 = { instancePath: instancePath + "/default/" + i3 + "/" + key8.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/$defs/mappingDefaultRow/additionalProperties/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err67];
                        } else {
                          vErrors.push(err67);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err68 = { instancePath: instancePath + "/default/" + i3, schemaPath: "#/$defs/mappingDefaultRow/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err68];
                    } else {
                      vErrors.push(err68);
                    }
                    errors++;
                  }
                }
              } else {
                const err69 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/5/allOf/1/properties/default/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                if (vErrors === null) {
                  vErrors = [err69];
                } else {
                  vErrors.push(err69);
                }
                errors++;
              }
            }
            if (data.columns !== undefined) {
              let data43 = data.columns;
              if (Array.isArray(data43)) {
                if (data43.length < 1) {
                  const err70 = { instancePath: instancePath + "/columns", schemaPath: "#/oneOf/5/allOf/1/properties/columns/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                  if (vErrors === null) {
                    vErrors = [err70];
                  } else {
                    vErrors.push(err70);
                  }
                  errors++;
                }
                const len4 = data43.length;
                for (let i4 = 0;i4 < len4; i4++) {
                  if (!validate53(data43[i4], { instancePath: instancePath + "/columns/" + i4, parentData: data43, parentDataProperty: i4, rootData, dynamicAnchors })) {
                    vErrors = vErrors === null ? validate53.errors : vErrors.concat(validate53.errors);
                    errors = vErrors.length;
                  }
                }
              } else {
                const err71 = { instancePath: instancePath + "/columns", schemaPath: "#/oneOf/5/allOf/1/properties/columns/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                if (vErrors === null) {
                  vErrors = [err71];
                } else {
                  vErrors.push(err71);
                }
                errors++;
              }
            }
            if (data.emit !== undefined) {
              if (!validate59(data.emit, { instancePath: instancePath + "/emit", parentData: data, parentDataProperty: "emit", rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate59.errors : vErrors.concat(validate59.errors);
                errors = vErrors.length;
              }
            }
            if (data.conflictGroups !== undefined) {
              let data46 = data.conflictGroups;
              if (Array.isArray(data46)) {
                const len5 = data46.length;
                for (let i5 = 0;i5 < len5; i5++) {
                  if (!validate61(data46[i5], { instancePath: instancePath + "/conflictGroups/" + i5, parentData: data46, parentDataProperty: i5, rootData, dynamicAnchors })) {
                    vErrors = vErrors === null ? validate61.errors : vErrors.concat(validate61.errors);
                    errors = vErrors.length;
                  }
                }
              } else {
                const err72 = { instancePath: instancePath + "/conflictGroups", schemaPath: "#/oneOf/5/allOf/1/properties/conflictGroups/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                if (vErrors === null) {
                  vErrors = [err72];
                } else {
                  vErrors.push(err72);
                }
                errors++;
              }
            }
          } else {
            const err73 = { instancePath, schemaPath: "#/oneOf/5/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err73];
            } else {
              vErrors.push(err73);
            }
            errors++;
          }
          if (data && typeof data == "object" && !Array.isArray(data)) {
            for (const key9 in data) {
              if (key9 !== "type" && key9 !== "default" && key9 !== "columns" && key9 !== "emit" && key9 !== "conflictGroups" && key9 !== "key" && key9 !== "emitKey" && key9 !== "label" && key9 !== "description" && key9 !== "required" && key9 !== "visibleWhen" && key9 !== "enabledWhen" && key9 !== "group" && key9 !== "notices" && key9 !== "defaultEmission") {
                const err74 = { instancePath, schemaPath: "#/oneOf/5/unevaluatedProperties", keyword: "unevaluatedProperties", params: { unevaluatedProperty: key9 }, message: "must NOT have unevaluated properties" };
                if (vErrors === null) {
                  vErrors = [err74];
                } else {
                  vErrors.push(err74);
                }
                errors++;
              }
            }
          } else {
            const err75 = { instancePath, schemaPath: "#/oneOf/5/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err75];
            } else {
              vErrors.push(err75);
            }
            errors++;
          }
          var _valid0 = _errs110 === errors;
          if (_valid0 && valid0) {
            valid0 = false;
            passing0 = [passing0, 5];
          } else {
            if (_valid0) {
              valid0 = true;
              passing0 = 5;
              if (props0 !== true) {
                props0 = true;
              }
            }
            const _errs132 = errors;
            if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
              errors = vErrors.length;
            }
            if (data && typeof data == "object" && !Array.isArray(data)) {
              if (data.type === undefined) {
                const err76 = { instancePath, schemaPath: "#/oneOf/6/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
                if (vErrors === null) {
                  vErrors = [err76];
                } else {
                  vErrors.push(err76);
                }
                errors++;
              }
              if (data.properties === undefined) {
                const err77 = { instancePath, schemaPath: "#/oneOf/6/allOf/1/required", keyword: "required", params: { missingProperty: "properties" }, message: "must have required property '" + "properties" + "'" };
                if (vErrors === null) {
                  vErrors = [err77];
                } else {
                  vErrors.push(err77);
                }
                errors++;
              }
              if (data.type !== undefined) {
                if (data.type !== "object") {
                  const err78 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/6/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "object" }, message: "must be equal to constant" };
                  if (vErrors === null) {
                    vErrors = [err78];
                  } else {
                    vErrors.push(err78);
                  }
                  errors++;
                }
              }
              if (data.default !== undefined) {
                let data49 = data.default;
                if (!(data49 && typeof data49 == "object" && !Array.isArray(data49))) {
                  const err79 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/6/allOf/1/properties/default/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err79];
                  } else {
                    vErrors.push(err79);
                  }
                  errors++;
                }
              }
              if (data.properties !== undefined) {
                let data50 = data.properties;
                if (Array.isArray(data50)) {
                  const len6 = data50.length;
                  for (let i6 = 0;i6 < len6; i6++) {
                    if (!wrapper2.validate(data50[i6], { instancePath: instancePath + "/properties/" + i6, parentData: data50, parentDataProperty: i6, rootData, dynamicAnchors })) {
                      vErrors = vErrors === null ? wrapper2.validate.errors : vErrors.concat(wrapper2.validate.errors);
                      errors = vErrors.length;
                    }
                  }
                } else {
                  const err80 = { instancePath: instancePath + "/properties", schemaPath: "#/oneOf/6/allOf/1/properties/properties/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                  if (vErrors === null) {
                    vErrors = [err80];
                  } else {
                    vErrors.push(err80);
                  }
                  errors++;
                }
              }
              if (data.emit !== undefined) {
                if (!validate31(data.emit, { instancePath: instancePath + "/emit", parentData: data, parentDataProperty: "emit", rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
                  errors = vErrors.length;
                }
              }
            } else {
              const err81 = { instancePath, schemaPath: "#/oneOf/6/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
              if (vErrors === null) {
                vErrors = [err81];
              } else {
                vErrors.push(err81);
              }
              errors++;
            }
            if (data && typeof data == "object" && !Array.isArray(data)) {
              for (const key10 in data) {
                if (key10 !== "type" && key10 !== "default" && key10 !== "properties" && key10 !== "emit" && key10 !== "key" && key10 !== "emitKey" && key10 !== "label" && key10 !== "description" && key10 !== "required" && key10 !== "visibleWhen" && key10 !== "enabledWhen" && key10 !== "group" && key10 !== "notices" && key10 !== "defaultEmission") {
                  const err82 = { instancePath, schemaPath: "#/oneOf/6/unevaluatedProperties", keyword: "unevaluatedProperties", params: { unevaluatedProperty: key10 }, message: "must NOT have unevaluated properties" };
                  if (vErrors === null) {
                    vErrors = [err82];
                  } else {
                    vErrors.push(err82);
                  }
                  errors++;
                }
              }
            } else {
              const err83 = { instancePath, schemaPath: "#/oneOf/6/type", keyword: "type", params: { type: "object" }, message: "must be object" };
              if (vErrors === null) {
                vErrors = [err83];
              } else {
                vErrors.push(err83);
              }
              errors++;
            }
            var _valid0 = _errs132 === errors;
            if (_valid0 && valid0) {
              valid0 = false;
              passing0 = [passing0, 6];
            } else {
              if (_valid0) {
                valid0 = true;
                passing0 = 6;
                if (props0 !== true) {
                  props0 = true;
                }
              }
              const _errs145 = errors;
              if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
                errors = vErrors.length;
              }
              if (data && typeof data == "object" && !Array.isArray(data)) {
                if (data.type === undefined) {
                  const err84 = { instancePath, schemaPath: "#/oneOf/7/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
                  if (vErrors === null) {
                    vErrors = [err84];
                  } else {
                    vErrors.push(err84);
                  }
                  errors++;
                }
                if (data.type !== undefined) {
                  if (data.type !== "color") {
                    const err85 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/7/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "color" }, message: "must be equal to constant" };
                    if (vErrors === null) {
                      vErrors = [err85];
                    } else {
                      vErrors.push(err85);
                    }
                    errors++;
                  }
                }
                if (data.default !== undefined) {
                  if (typeof data.default !== "string") {
                    const err86 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/7/allOf/1/properties/default/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err86];
                    } else {
                      vErrors.push(err86);
                    }
                    errors++;
                  }
                }
                if (data.format !== undefined) {
                  let data55 = data.format;
                  if (typeof data55 !== "string") {
                    const err87 = { instancePath: instancePath + "/format", schemaPath: "#/oneOf/7/allOf/1/properties/format/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                      vErrors = [err87];
                    } else {
                      vErrors.push(err87);
                    }
                    errors++;
                  }
                  if (!(data55 === "hex" || data55 === "rgb" || data55 === "hsl")) {
                    const err88 = { instancePath: instancePath + "/format", schemaPath: "#/oneOf/7/allOf/1/properties/format/enum", keyword: "enum", params: { allowedValues: schema38.oneOf[7].allOf[1].properties.format.enum }, message: "must be equal to one of the allowed values" };
                    if (vErrors === null) {
                      vErrors = [err88];
                    } else {
                      vErrors.push(err88);
                    }
                    errors++;
                  }
                }
                if (data.emit !== undefined) {
                  if (!validate31(data.emit, { instancePath: instancePath + "/emit", parentData: data, parentDataProperty: "emit", rootData, dynamicAnchors })) {
                    vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
                    errors = vErrors.length;
                  }
                }
              } else {
                const err89 = { instancePath, schemaPath: "#/oneOf/7/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                if (vErrors === null) {
                  vErrors = [err89];
                } else {
                  vErrors.push(err89);
                }
                errors++;
              }
              if (data && typeof data == "object" && !Array.isArray(data)) {
                for (const key11 in data) {
                  if (key11 !== "type" && key11 !== "default" && key11 !== "format" && key11 !== "emit" && key11 !== "key" && key11 !== "emitKey" && key11 !== "label" && key11 !== "description" && key11 !== "required" && key11 !== "visibleWhen" && key11 !== "enabledWhen" && key11 !== "group" && key11 !== "notices" && key11 !== "defaultEmission") {
                    const err90 = { instancePath, schemaPath: "#/oneOf/7/unevaluatedProperties", keyword: "unevaluatedProperties", params: { unevaluatedProperty: key11 }, message: "must NOT have unevaluated properties" };
                    if (vErrors === null) {
                      vErrors = [err90];
                    } else {
                      vErrors.push(err90);
                    }
                    errors++;
                  }
                }
              } else {
                const err91 = { instancePath, schemaPath: "#/oneOf/7/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                if (vErrors === null) {
                  vErrors = [err91];
                } else {
                  vErrors.push(err91);
                }
                errors++;
              }
              var _valid0 = _errs145 === errors;
              if (_valid0 && valid0) {
                valid0 = false;
                passing0 = [passing0, 7];
              } else {
                if (_valid0) {
                  valid0 = true;
                  passing0 = 7;
                  if (props0 !== true) {
                    props0 = true;
                  }
                }
                const _errs157 = errors;
                if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
                  vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
                  errors = vErrors.length;
                }
                if (data && typeof data == "object" && !Array.isArray(data)) {
                  if (data.type === undefined) {
                    const err92 = { instancePath, schemaPath: "#/oneOf/8/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
                    if (vErrors === null) {
                      vErrors = [err92];
                    } else {
                      vErrors.push(err92);
                    }
                    errors++;
                  }
                  if (data.type !== undefined) {
                    if (data.type !== "keysequence") {
                      const err93 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/8/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "keysequence" }, message: "must be equal to constant" };
                      if (vErrors === null) {
                        vErrors = [err93];
                      } else {
                        vErrors.push(err93);
                      }
                      errors++;
                    }
                  }
                  if (data.default !== undefined) {
                    if (typeof data.default !== "string") {
                      const err94 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/8/allOf/1/properties/default/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                      if (vErrors === null) {
                        vErrors = [err94];
                      } else {
                        vErrors.push(err94);
                      }
                      errors++;
                    }
                  }
                  if (data.emit !== undefined) {
                    if (!validate31(data.emit, { instancePath: instancePath + "/emit", parentData: data, parentDataProperty: "emit", rootData, dynamicAnchors })) {
                      vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
                      errors = vErrors.length;
                    }
                  }
                } else {
                  const err95 = { instancePath, schemaPath: "#/oneOf/8/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err95];
                  } else {
                    vErrors.push(err95);
                  }
                  errors++;
                }
                if (data && typeof data == "object" && !Array.isArray(data)) {
                  for (const key12 in data) {
                    if (key12 !== "type" && key12 !== "default" && key12 !== "emit" && key12 !== "key" && key12 !== "emitKey" && key12 !== "label" && key12 !== "description" && key12 !== "required" && key12 !== "visibleWhen" && key12 !== "enabledWhen" && key12 !== "group" && key12 !== "notices" && key12 !== "defaultEmission") {
                      const err96 = { instancePath, schemaPath: "#/oneOf/8/unevaluatedProperties", keyword: "unevaluatedProperties", params: { unevaluatedProperty: key12 }, message: "must NOT have unevaluated properties" };
                      if (vErrors === null) {
                        vErrors = [err96];
                      } else {
                        vErrors.push(err96);
                      }
                      errors++;
                    }
                  }
                } else {
                  const err97 = { instancePath, schemaPath: "#/oneOf/8/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                  if (vErrors === null) {
                    vErrors = [err97];
                  } else {
                    vErrors.push(err97);
                  }
                  errors++;
                }
                var _valid0 = _errs157 === errors;
                if (_valid0 && valid0) {
                  valid0 = false;
                  passing0 = [passing0, 8];
                } else {
                  if (_valid0) {
                    valid0 = true;
                    passing0 = 8;
                    if (props0 !== true) {
                      props0 = true;
                    }
                  }
                  const _errs167 = errors;
                  if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
                    vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
                    errors = vErrors.length;
                  }
                  if (data && typeof data == "object" && !Array.isArray(data)) {
                    if (data.type === undefined) {
                      const err98 = { instancePath, schemaPath: "#/oneOf/9/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
                      if (vErrors === null) {
                        vErrors = [err98];
                      } else {
                        vErrors.push(err98);
                      }
                      errors++;
                    }
                    if (data.type !== undefined) {
                      if (data.type !== "lua") {
                        const err99 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/9/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "lua" }, message: "must be equal to constant" };
                        if (vErrors === null) {
                          vErrors = [err99];
                        } else {
                          vErrors.push(err99);
                        }
                        errors++;
                      }
                    }
                    if (data.default !== undefined) {
                      if (typeof data.default !== "string") {
                        const err100 = { instancePath: instancePath + "/default", schemaPath: "#/oneOf/9/allOf/1/properties/default/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err100];
                        } else {
                          vErrors.push(err100);
                        }
                        errors++;
                      }
                    }
                    if (data.inputPlaceholder !== undefined) {
                      if (typeof data.inputPlaceholder !== "string") {
                        const err101 = { instancePath: instancePath + "/inputPlaceholder", schemaPath: "#/oneOf/9/allOf/1/properties/inputPlaceholder/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err101];
                        } else {
                          vErrors.push(err101);
                        }
                        errors++;
                      }
                    }
                    if (data.uiHint !== undefined) {
                      let data63 = data.uiHint;
                      if (typeof data63 !== "string") {
                        const err102 = { instancePath: instancePath + "/uiHint", schemaPath: "#/oneOf/9/allOf/1/properties/uiHint/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err102];
                        } else {
                          vErrors.push(err102);
                        }
                        errors++;
                      }
                      if (!(data63 === "input" || data63 === "textarea")) {
                        const err103 = { instancePath: instancePath + "/uiHint", schemaPath: "#/oneOf/9/allOf/1/properties/uiHint/enum", keyword: "enum", params: { allowedValues: schema38.oneOf[9].allOf[1].properties.uiHint.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err103];
                        } else {
                          vErrors.push(err103);
                        }
                        errors++;
                      }
                    }
                    if (data.expectedReturnType !== undefined) {
                      let data64 = data.expectedReturnType;
                      if (typeof data64 !== "string") {
                        const err104 = { instancePath: instancePath + "/expectedReturnType", schemaPath: "#/$defs/portDataType/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err104];
                        } else {
                          vErrors.push(err104);
                        }
                        errors++;
                      }
                      if (!(data64 === "any" || data64 === "string" || data64 === "number" || data64 === "boolean" || data64 === "buffer" || data64 === "window" || data64 === "table" || data64 === "void")) {
                        const err105 = { instancePath: instancePath + "/expectedReturnType", schemaPath: "#/$defs/portDataType/enum", keyword: "enum", params: { allowedValues: schema83.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err105];
                        } else {
                          vErrors.push(err105);
                        }
                        errors++;
                      }
                    }
                    if (data.emit !== undefined) {
                      if (!validate31(data.emit, { instancePath: instancePath + "/emit", parentData: data, parentDataProperty: "emit", rootData, dynamicAnchors })) {
                        vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
                        errors = vErrors.length;
                      }
                    }
                  } else {
                    const err106 = { instancePath, schemaPath: "#/oneOf/9/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err106];
                    } else {
                      vErrors.push(err106);
                    }
                    errors++;
                  }
                  if (data && typeof data == "object" && !Array.isArray(data)) {
                    for (const key13 in data) {
                      if (key13 !== "type" && key13 !== "default" && key13 !== "inputPlaceholder" && key13 !== "uiHint" && key13 !== "expectedReturnType" && key13 !== "emit" && key13 !== "key" && key13 !== "emitKey" && key13 !== "label" && key13 !== "description" && key13 !== "required" && key13 !== "visibleWhen" && key13 !== "enabledWhen" && key13 !== "group" && key13 !== "notices" && key13 !== "defaultEmission") {
                        const err107 = { instancePath, schemaPath: "#/oneOf/9/unevaluatedProperties", keyword: "unevaluatedProperties", params: { unevaluatedProperty: key13 }, message: "must NOT have unevaluated properties" };
                        if (vErrors === null) {
                          vErrors = [err107];
                        } else {
                          vErrors.push(err107);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err108 = { instancePath, schemaPath: "#/oneOf/9/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err108];
                    } else {
                      vErrors.push(err108);
                    }
                    errors++;
                  }
                  var _valid0 = _errs167 === errors;
                  if (_valid0 && valid0) {
                    valid0 = false;
                    passing0 = [passing0, 9];
                  } else {
                    if (_valid0) {
                      valid0 = true;
                      passing0 = 9;
                      if (props0 !== true) {
                        props0 = true;
                      }
                    }
                    const _errs184 = errors;
                    if (!validate24(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
                      vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
                      errors = vErrors.length;
                    }
                    if (data && typeof data == "object" && !Array.isArray(data)) {
                      if (data.type === undefined) {
                        const err109 = { instancePath, schemaPath: "#/oneOf/10/allOf/1/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
                        if (vErrors === null) {
                          vErrors = [err109];
                        } else {
                          vErrors.push(err109);
                        }
                        errors++;
                      }
                      if (data.commands === undefined) {
                        const err110 = { instancePath, schemaPath: "#/oneOf/10/allOf/1/required", keyword: "required", params: { missingProperty: "commands" }, message: "must have required property '" + "commands" + "'" };
                        if (vErrors === null) {
                          vErrors = [err110];
                        } else {
                          vErrors.push(err110);
                        }
                        errors++;
                      }
                      if (data.presets === undefined) {
                        const err111 = { instancePath, schemaPath: "#/oneOf/10/allOf/1/required", keyword: "required", params: { missingProperty: "presets" }, message: "must have required property '" + "presets" + "'" };
                        if (vErrors === null) {
                          vErrors = [err111];
                        } else {
                          vErrors.push(err111);
                        }
                        errors++;
                      }
                      if (data.defaultPreset === undefined) {
                        const err112 = { instancePath, schemaPath: "#/oneOf/10/allOf/1/required", keyword: "required", params: { missingProperty: "defaultPreset" }, message: "must have required property '" + "defaultPreset" + "'" };
                        if (vErrors === null) {
                          vErrors = [err112];
                        } else {
                          vErrors.push(err112);
                        }
                        errors++;
                      }
                      if (data.type !== undefined) {
                        if (data.type !== "plugin-keymap") {
                          const err113 = { instancePath: instancePath + "/type", schemaPath: "#/oneOf/10/allOf/1/properties/type/const", keyword: "const", params: { allowedValue: "plugin-keymap" }, message: "must be equal to constant" };
                          if (vErrors === null) {
                            vErrors = [err113];
                          } else {
                            vErrors.push(err113);
                          }
                          errors++;
                        }
                      }
                      if (data.commands !== undefined) {
                        let data67 = data.commands;
                        if (Array.isArray(data67)) {
                          if (data67.length < 1) {
                            const err114 = { instancePath: instancePath + "/commands", schemaPath: "#/oneOf/10/allOf/1/properties/commands/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                            if (vErrors === null) {
                              vErrors = [err114];
                            } else {
                              vErrors.push(err114);
                            }
                            errors++;
                          }
                          const len7 = data67.length;
                          for (let i7 = 0;i7 < len7; i7++) {
                            if (!validate72(data67[i7], { instancePath: instancePath + "/commands/" + i7, parentData: data67, parentDataProperty: i7, rootData, dynamicAnchors })) {
                              vErrors = vErrors === null ? validate72.errors : vErrors.concat(validate72.errors);
                              errors = vErrors.length;
                            }
                          }
                        } else {
                          const err115 = { instancePath: instancePath + "/commands", schemaPath: "#/oneOf/10/allOf/1/properties/commands/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                          if (vErrors === null) {
                            vErrors = [err115];
                          } else {
                            vErrors.push(err115);
                          }
                          errors++;
                        }
                      }
                      if (data.presets !== undefined) {
                        let data69 = data.presets;
                        if (Array.isArray(data69)) {
                          if (data69.length < 1) {
                            const err116 = { instancePath: instancePath + "/presets", schemaPath: "#/oneOf/10/allOf/1/properties/presets/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
                            if (vErrors === null) {
                              vErrors = [err116];
                            } else {
                              vErrors.push(err116);
                            }
                            errors++;
                          }
                          const len8 = data69.length;
                          for (let i8 = 0;i8 < len8; i8++) {
                            if (!validate74(data69[i8], { instancePath: instancePath + "/presets/" + i8, parentData: data69, parentDataProperty: i8, rootData, dynamicAnchors })) {
                              vErrors = vErrors === null ? validate74.errors : vErrors.concat(validate74.errors);
                              errors = vErrors.length;
                            }
                          }
                        } else {
                          const err117 = { instancePath: instancePath + "/presets", schemaPath: "#/oneOf/10/allOf/1/properties/presets/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                          if (vErrors === null) {
                            vErrors = [err117];
                          } else {
                            vErrors.push(err117);
                          }
                          errors++;
                        }
                      }
                      if (data.defaultPreset !== undefined) {
                        let data71 = data.defaultPreset;
                        if (typeof data71 === "string") {
                          if (func2(data71) < 1) {
                            const err118 = { instancePath: instancePath + "/defaultPreset", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                            if (vErrors === null) {
                              vErrors = [err118];
                            } else {
                              vErrors.push(err118);
                            }
                            errors++;
                          }
                        } else {
                          const err119 = { instancePath: instancePath + "/defaultPreset", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                          if (vErrors === null) {
                            vErrors = [err119];
                          } else {
                            vErrors.push(err119);
                          }
                          errors++;
                        }
                      }
                      if (data.allowDisable !== undefined) {
                        if (typeof data.allowDisable !== "boolean") {
                          const err120 = { instancePath: instancePath + "/allowDisable", schemaPath: "#/oneOf/10/allOf/1/properties/allowDisable/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                          if (vErrors === null) {
                            vErrors = [err120];
                          } else {
                            vErrors.push(err120);
                          }
                          errors++;
                        }
                      }
                      if (data.emit !== undefined) {
                        if (!validate31(data.emit, { instancePath: instancePath + "/emit", parentData: data, parentDataProperty: "emit", rootData, dynamicAnchors })) {
                          vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
                          errors = vErrors.length;
                        }
                      }
                    } else {
                      const err121 = { instancePath, schemaPath: "#/oneOf/10/allOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err121];
                      } else {
                        vErrors.push(err121);
                      }
                      errors++;
                    }
                    if (data && typeof data == "object" && !Array.isArray(data)) {
                      for (const key14 in data) {
                        if (key14 !== "type" && key14 !== "commands" && key14 !== "presets" && key14 !== "defaultPreset" && key14 !== "allowDisable" && key14 !== "emit" && key14 !== "key" && key14 !== "emitKey" && key14 !== "label" && key14 !== "description" && key14 !== "required" && key14 !== "visibleWhen" && key14 !== "enabledWhen" && key14 !== "group" && key14 !== "notices" && key14 !== "defaultEmission") {
                          const err122 = { instancePath, schemaPath: "#/oneOf/10/unevaluatedProperties", keyword: "unevaluatedProperties", params: { unevaluatedProperty: key14 }, message: "must NOT have unevaluated properties" };
                          if (vErrors === null) {
                            vErrors = [err122];
                          } else {
                            vErrors.push(err122);
                          }
                          errors++;
                        }
                      }
                    } else {
                      const err123 = { instancePath, schemaPath: "#/oneOf/10/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                      if (vErrors === null) {
                        vErrors = [err123];
                      } else {
                        vErrors.push(err123);
                      }
                      errors++;
                    }
                    var _valid0 = _errs184 === errors;
                    if (_valid0 && valid0) {
                      valid0 = false;
                      passing0 = [passing0, 10];
                    } else {
                      if (_valid0) {
                        valid0 = true;
                        passing0 = 10;
                        if (props0 !== true) {
                          props0 = true;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err124 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err124];
    } else {
      vErrors.push(err124);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate23.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate23.evaluated = { dynamicProps: true, dynamicItems: false };
var schema92 = { type: "object", required: ["name", "params", "luaCall"], properties: { name: { $ref: "#/$defs/nonEmptyString" }, description: { type: "string" }, params: { type: "array", items: { $ref: "#/$defs/functionParam" } }, returns: { $ref: "#/$defs/portDataType" }, luaCall: { $ref: "#/$defs/nonEmptyString" }, paramEmission: { type: "object", properties: { unsetOptional: { type: "string", enum: ["emit-nil", "omit-trailing"] } }, additionalProperties: false }, label: { $ref: "#/$defs/nonEmptyString" }, shortDescription: { $ref: "#/$defs/nonEmptyString" }, whatItDoes: { $ref: "#/$defs/nonEmptyString" }, technicalNote: { $ref: "#/$defs/nonEmptyString" }, isPopular: { type: "boolean" }, aliases: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } }, category: { $ref: "#/$defs/nonEmptyString" }, example: { $ref: "#/$defs/nonEmptyString" }, sourceDoc: { $ref: "#/$defs/nonEmptyString" }, relatedCommand: { $ref: "#/$defs/nonEmptyString" } }, additionalProperties: false };
var schema94 = { type: "object", required: ["name", "type"], properties: { name: { $ref: "#/$defs/nonEmptyString" }, type: { $ref: "#/$defs/portDataType" }, optional: { type: "boolean" }, description: { type: "string" }, tier: { type: "string", enum: ["basic", "advanced"] }, group: { type: "string" }, allowedValues: { type: "array", items: { type: "string" } }, allowedValueDescriptions: { type: "object", additionalProperties: { type: "string" } }, multi: { type: "boolean" }, objectShape: { type: "array", items: { $ref: "#/$defs/functionParam" } }, defaultValue: { $ref: "#/$defs/functionDefault" }, portLabel: { type: "string" }, example: { type: "string" } }, additionalProperties: false };
var wrapper3 = { validate: validate79 };
var schema97 = { oneOf: [{ type: "object", required: ["kind", "value"], properties: { kind: { const: "scalar" }, value: { type: ["string", "number", "boolean"] } }, additionalProperties: false }, { type: "object", required: ["kind", "lua"], properties: { kind: { const: "lua" }, lua: { type: "string" } }, additionalProperties: false }, { type: "object", required: ["kind", "values"], properties: { kind: { const: "multiselect" }, values: { type: "array", items: { type: "string" } } }, additionalProperties: false }, { type: "object", required: ["kind", "entries"], properties: { kind: { const: "object" }, entries: { type: "object", additionalProperties: { $ref: "#/$defs/functionDefault" } } }, additionalProperties: false }] };
var wrapper4 = { validate: validate80 };
function validate80(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate80.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.value === undefined) {
      const err1 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property '" + "value" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "kind" || key0 === "value")) {
        const err2 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if (data.kind !== "scalar") {
        const err3 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/0/properties/kind/const", keyword: "const", params: { allowedValue: "scalar" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.value !== undefined) {
      let data1 = data.value;
      if (typeof data1 !== "string" && !(typeof data1 == "number" && isFinite(data1)) && typeof data1 !== "boolean") {
        const err4 = { instancePath: instancePath + "/value", schemaPath: "#/oneOf/0/properties/value/type", keyword: "type", params: { type: schema97.oneOf[0].properties.value.type }, message: "must be string,number,boolean" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
  } else {
    const err5 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs7 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err6 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.lua === undefined) {
      const err7 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "lua" }, message: "must have required property '" + "lua" + "'" };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    for (const key1 in data) {
      if (!(key1 === "kind" || key1 === "lua")) {
        const err8 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if (data.kind !== "lua") {
        const err9 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/1/properties/kind/const", keyword: "const", params: { allowedValue: "lua" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.lua !== undefined) {
      if (typeof data.lua !== "string") {
        const err10 = { instancePath: instancePath + "/lua", schemaPath: "#/oneOf/1/properties/lua/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
  } else {
    const err11 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  var _valid0 = _errs7 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs13 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.kind === undefined) {
        const err12 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
      if (data.values === undefined) {
        const err13 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "values" }, message: "must have required property '" + "values" + "'" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
      for (const key2 in data) {
        if (!(key2 === "kind" || key2 === "values")) {
          const err14 = { instancePath, schemaPath: "#/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      }
      if (data.kind !== undefined) {
        if (data.kind !== "multiselect") {
          const err15 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/2/properties/kind/const", keyword: "const", params: { allowedValue: "multiselect" }, message: "must be equal to constant" };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      }
      if (data.values !== undefined) {
        let data5 = data.values;
        if (Array.isArray(data5)) {
          const len0 = data5.length;
          for (let i0 = 0;i0 < len0; i0++) {
            if (typeof data5[i0] !== "string") {
              const err16 = { instancePath: instancePath + "/values/" + i0, schemaPath: "#/oneOf/2/properties/values/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err16];
              } else {
                vErrors.push(err16);
              }
              errors++;
            }
          }
        } else {
          const err17 = { instancePath: instancePath + "/values", schemaPath: "#/oneOf/2/properties/values/type", keyword: "type", params: { type: "array" }, message: "must be array" };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      }
    } else {
      const err18 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    var _valid0 = _errs13 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
      const _errs21 = errors;
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.kind === undefined) {
          const err19 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (data.entries === undefined) {
          const err20 = { instancePath, schemaPath: "#/oneOf/3/required", keyword: "required", params: { missingProperty: "entries" }, message: "must have required property '" + "entries" + "'" };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        for (const key3 in data) {
          if (!(key3 === "kind" || key3 === "entries")) {
            const err21 = { instancePath, schemaPath: "#/oneOf/3/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          }
        }
        if (data.kind !== undefined) {
          if (data.kind !== "object") {
            const err22 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/3/properties/kind/const", keyword: "const", params: { allowedValue: "object" }, message: "must be equal to constant" };
            if (vErrors === null) {
              vErrors = [err22];
            } else {
              vErrors.push(err22);
            }
            errors++;
          }
        }
        if (data.entries !== undefined) {
          let data8 = data.entries;
          if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
            for (const key4 in data8) {
              if (!wrapper4.validate(data8[key4], { instancePath: instancePath + "/entries/" + key4.replace(/~/g, "~0").replace(/\//g, "~1"), parentData: data8, parentDataProperty: key4, rootData, dynamicAnchors })) {
                vErrors = vErrors === null ? wrapper4.validate.errors : vErrors.concat(wrapper4.validate.errors);
                errors = vErrors.length;
              }
            }
          } else {
            const err23 = { instancePath: instancePath + "/entries", schemaPath: "#/oneOf/3/properties/entries/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
      } else {
        const err24 = { instancePath, schemaPath: "#/oneOf/3/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
      var _valid0 = _errs21 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = true;
          }
        }
      }
    }
  }
  if (!valid0) {
    const err25 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err25];
    } else {
      vErrors.push(err25);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate80.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate80.evaluated = { dynamicProps: true, dynamicItems: false };
function validate79(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate79.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.name === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "name" }, message: "must have required property '" + "name" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema94.properties, key0)) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.name !== undefined) {
      let data0 = data.name;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err3 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      let data1 = data.type;
      if (typeof data1 !== "string") {
        const err5 = { instancePath: instancePath + "/type", schemaPath: "#/$defs/portDataType/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
      if (!(data1 === "any" || data1 === "string" || data1 === "number" || data1 === "boolean" || data1 === "buffer" || data1 === "window" || data1 === "table" || data1 === "void")) {
        const err6 = { instancePath: instancePath + "/type", schemaPath: "#/$defs/portDataType/enum", keyword: "enum", params: { allowedValues: schema83.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.optional !== undefined) {
      if (typeof data.optional !== "boolean") {
        const err7 = { instancePath: instancePath + "/optional", schemaPath: "#/properties/optional/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      if (typeof data.description !== "string") {
        const err8 = { instancePath: instancePath + "/description", schemaPath: "#/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.tier !== undefined) {
      let data4 = data.tier;
      if (typeof data4 !== "string") {
        const err9 = { instancePath: instancePath + "/tier", schemaPath: "#/properties/tier/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      if (!(data4 === "basic" || data4 === "advanced")) {
        const err10 = { instancePath: instancePath + "/tier", schemaPath: "#/properties/tier/enum", keyword: "enum", params: { allowedValues: schema94.properties.tier.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.group !== undefined) {
      if (typeof data.group !== "string") {
        const err11 = { instancePath: instancePath + "/group", schemaPath: "#/properties/group/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.allowedValues !== undefined) {
      let data6 = data.allowedValues;
      if (Array.isArray(data6)) {
        const len0 = data6.length;
        for (let i0 = 0;i0 < len0; i0++) {
          if (typeof data6[i0] !== "string") {
            const err12 = { instancePath: instancePath + "/allowedValues/" + i0, schemaPath: "#/properties/allowedValues/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
        }
      } else {
        const err13 = { instancePath: instancePath + "/allowedValues", schemaPath: "#/properties/allowedValues/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.allowedValueDescriptions !== undefined) {
      let data8 = data.allowedValueDescriptions;
      if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
        for (const key1 in data8) {
          if (typeof data8[key1] !== "string") {
            const err14 = { instancePath: instancePath + "/allowedValueDescriptions/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/allowedValueDescriptions/additionalProperties/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
        }
      } else {
        const err15 = { instancePath: instancePath + "/allowedValueDescriptions", schemaPath: "#/properties/allowedValueDescriptions/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.multi !== undefined) {
      if (typeof data.multi !== "boolean") {
        const err16 = { instancePath: instancePath + "/multi", schemaPath: "#/properties/multi/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.objectShape !== undefined) {
      let data11 = data.objectShape;
      if (Array.isArray(data11)) {
        const len1 = data11.length;
        for (let i1 = 0;i1 < len1; i1++) {
          if (!wrapper3.validate(data11[i1], { instancePath: instancePath + "/objectShape/" + i1, parentData: data11, parentDataProperty: i1, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? wrapper3.validate.errors : vErrors.concat(wrapper3.validate.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err17 = { instancePath: instancePath + "/objectShape", schemaPath: "#/properties/objectShape/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.defaultValue !== undefined) {
      if (!validate80(data.defaultValue, { instancePath: instancePath + "/defaultValue", parentData: data, parentDataProperty: "defaultValue", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate80.errors : vErrors.concat(validate80.errors);
        errors = vErrors.length;
      }
    }
    if (data.portLabel !== undefined) {
      if (typeof data.portLabel !== "string") {
        const err18 = { instancePath: instancePath + "/portLabel", schemaPath: "#/properties/portLabel/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.example !== undefined) {
      if (typeof data.example !== "string") {
        const err19 = { instancePath: instancePath + "/example", schemaPath: "#/properties/example/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
  } else {
    const err20 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err20];
    } else {
      vErrors.push(err20);
    }
    errors++;
  }
  validate79.errors = vErrors;
  return errors === 0;
}
validate79.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate78(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate78.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.name === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "name" }, message: "must have required property '" + "name" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.params === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "params" }, message: "must have required property '" + "params" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.luaCall === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "luaCall" }, message: "must have required property '" + "luaCall" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema92.properties, key0)) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.name !== undefined) {
      let data0 = data.name;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err4 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      if (typeof data.description !== "string") {
        const err6 = { instancePath: instancePath + "/description", schemaPath: "#/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.params !== undefined) {
      let data2 = data.params;
      if (Array.isArray(data2)) {
        const len0 = data2.length;
        for (let i0 = 0;i0 < len0; i0++) {
          if (!validate79(data2[i0], { instancePath: instancePath + "/params/" + i0, parentData: data2, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate79.errors : vErrors.concat(validate79.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err7 = { instancePath: instancePath + "/params", schemaPath: "#/properties/params/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.returns !== undefined) {
      let data4 = data.returns;
      if (typeof data4 !== "string") {
        const err8 = { instancePath: instancePath + "/returns", schemaPath: "#/$defs/portDataType/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
      if (!(data4 === "any" || data4 === "string" || data4 === "number" || data4 === "boolean" || data4 === "buffer" || data4 === "window" || data4 === "table" || data4 === "void")) {
        const err9 = { instancePath: instancePath + "/returns", schemaPath: "#/$defs/portDataType/enum", keyword: "enum", params: { allowedValues: schema83.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.luaCall !== undefined) {
      let data5 = data.luaCall;
      if (typeof data5 === "string") {
        if (func2(data5) < 1) {
          const err10 = { instancePath: instancePath + "/luaCall", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/luaCall", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.paramEmission !== undefined) {
      let data6 = data.paramEmission;
      if (data6 && typeof data6 == "object" && !Array.isArray(data6)) {
        for (const key1 in data6) {
          if (!(key1 === "unsetOptional")) {
            const err12 = { instancePath: instancePath + "/paramEmission", schemaPath: "#/properties/paramEmission/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
        }
        if (data6.unsetOptional !== undefined) {
          let data7 = data6.unsetOptional;
          if (typeof data7 !== "string") {
            const err13 = { instancePath: instancePath + "/paramEmission/unsetOptional", schemaPath: "#/properties/paramEmission/properties/unsetOptional/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err13];
            } else {
              vErrors.push(err13);
            }
            errors++;
          }
          if (!(data7 === "emit-nil" || data7 === "omit-trailing")) {
            const err14 = { instancePath: instancePath + "/paramEmission/unsetOptional", schemaPath: "#/properties/paramEmission/properties/unsetOptional/enum", keyword: "enum", params: { allowedValues: schema92.properties.paramEmission.properties.unsetOptional.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
        }
      } else {
        const err15 = { instancePath: instancePath + "/paramEmission", schemaPath: "#/properties/paramEmission/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      let data8 = data.label;
      if (typeof data8 === "string") {
        if (func2(data8) < 1) {
          const err16 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.shortDescription !== undefined) {
      let data9 = data.shortDescription;
      if (typeof data9 === "string") {
        if (func2(data9) < 1) {
          const err18 = { instancePath: instancePath + "/shortDescription", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      } else {
        const err19 = { instancePath: instancePath + "/shortDescription", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.whatItDoes !== undefined) {
      let data10 = data.whatItDoes;
      if (typeof data10 === "string") {
        if (func2(data10) < 1) {
          const err20 = { instancePath: instancePath + "/whatItDoes", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = { instancePath: instancePath + "/whatItDoes", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.technicalNote !== undefined) {
      let data11 = data.technicalNote;
      if (typeof data11 === "string") {
        if (func2(data11) < 1) {
          const err22 = { instancePath: instancePath + "/technicalNote", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      } else {
        const err23 = { instancePath: instancePath + "/technicalNote", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.isPopular !== undefined) {
      if (typeof data.isPopular !== "boolean") {
        const err24 = { instancePath: instancePath + "/isPopular", schemaPath: "#/properties/isPopular/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.aliases !== undefined) {
      let data13 = data.aliases;
      if (Array.isArray(data13)) {
        const len1 = data13.length;
        for (let i1 = 0;i1 < len1; i1++) {
          let data14 = data13[i1];
          if (typeof data14 === "string") {
            if (func2(data14) < 1) {
              const err25 = { instancePath: instancePath + "/aliases/" + i1, schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err25];
              } else {
                vErrors.push(err25);
              }
              errors++;
            }
          } else {
            const err26 = { instancePath: instancePath + "/aliases/" + i1, schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
        }
      } else {
        const err27 = { instancePath: instancePath + "/aliases", schemaPath: "#/properties/aliases/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.category !== undefined) {
      let data15 = data.category;
      if (typeof data15 === "string") {
        if (func2(data15) < 1) {
          const err28 = { instancePath: instancePath + "/category", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
      } else {
        const err29 = { instancePath: instancePath + "/category", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.example !== undefined) {
      let data16 = data.example;
      if (typeof data16 === "string") {
        if (func2(data16) < 1) {
          const err30 = { instancePath: instancePath + "/example", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
      } else {
        const err31 = { instancePath: instancePath + "/example", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err31];
        } else {
          vErrors.push(err31);
        }
        errors++;
      }
    }
    if (data.sourceDoc !== undefined) {
      let data17 = data.sourceDoc;
      if (typeof data17 === "string") {
        if (func2(data17) < 1) {
          const err32 = { instancePath: instancePath + "/sourceDoc", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
      } else {
        const err33 = { instancePath: instancePath + "/sourceDoc", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err33];
        } else {
          vErrors.push(err33);
        }
        errors++;
      }
    }
    if (data.relatedCommand !== undefined) {
      let data18 = data.relatedCommand;
      if (typeof data18 === "string") {
        if (func2(data18) < 1) {
          const err34 = { instancePath: instancePath + "/relatedCommand", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
      } else {
        const err35 = { instancePath: instancePath + "/relatedCommand", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
    }
  } else {
    const err36 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err36];
    } else {
      vErrors.push(err36);
    }
    errors++;
  }
  validate78.errors = vErrors;
  return errors === 0;
}
validate78.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema110 = { type: "object", required: ["name", "description", "template", "example", "sourceDoc"], properties: { name: { $ref: "#/$defs/nonEmptyString" }, description: { $ref: "#/$defs/nonEmptyString" }, template: { $ref: "#/$defs/nonEmptyString" }, example: { $ref: "#/$defs/nonEmptyString" }, sourceDoc: { $ref: "#/$defs/nonEmptyString" }, params: { type: "array", items: { $ref: "#/$defs/exCommandParam" } }, label: { $ref: "#/$defs/nonEmptyString" }, shortDescription: { $ref: "#/$defs/nonEmptyString" }, category: { $ref: "#/$defs/nonEmptyString" }, whatItDoes: { $ref: "#/$defs/nonEmptyString" }, technicalNote: { $ref: "#/$defs/nonEmptyString" }, isPopular: { type: "boolean" }, aliases: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } } }, additionalProperties: false };
var schema116 = { type: "object", required: ["name", "placeholder", "description"], properties: { name: { $ref: "#/$defs/nonEmptyString" }, placeholder: { type: "string" }, description: { $ref: "#/$defs/nonEmptyString" }, label: { type: "string" }, type: { type: "string", enum: ["string", "number", "boolean", "file-path", "directory-path", "select"] }, optional: { type: "boolean" }, defaultValue: { type: ["string", "number", "boolean"] }, allowedValues: { type: "array", items: { type: "string" } }, allowedValueDescriptions: { type: "object", additionalProperties: { type: "string" } }, tier: { type: "string", enum: ["basic", "advanced"] }, group: { type: "string" }, escape: { const: "ex-argument" }, emit: { $ref: "#/$defs/exCommandParamEmit" } }, allOf: [{ if: { properties: { type: { const: "select" } }, required: ["type"] }, then: { properties: { allowedValues: {} }, required: ["allowedValues"] }, else: { not: { properties: { allowedValues: {} }, required: ["allowedValues"] } } }, { if: { properties: { type: { const: "select" } }, required: ["type"] }, else: { not: { properties: { allowedValueDescriptions: {} }, required: ["allowedValueDescriptions"] } } }, { if: { properties: { type: { const: "number" } }, required: ["type"] }, then: { properties: { defaultValue: { type: "number" } } }, else: { if: { properties: { type: { const: "boolean" } }, required: ["type"] }, then: { properties: { defaultValue: { type: "boolean" } } }, else: { properties: { defaultValue: { type: "string" } } } } }, { if: { properties: { emit: { type: "object", properties: { kind: { const: "flag" } }, required: ["kind"] } }, required: ["emit"] }, then: { properties: { type: { const: "boolean" } }, required: ["type"] } }, { if: { properties: { emit: { type: "object", properties: { kind: { const: "option" } }, required: ["kind"] } }, required: ["emit"] }, then: { properties: { type: { not: { const: "boolean" } } } } }], additionalProperties: false };
function validate86(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate86.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "kind")) {
        const err1 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if (data.kind !== "value") {
        const err2 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/0/properties/kind/const", keyword: "const", params: { allowedValue: "value" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
  } else {
    const err3 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs5 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err4 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.token === undefined) {
      const err5 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "token" }, message: "must have required property '" + "token" + "'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    for (const key1 in data) {
      if (!(key1 === "kind" || key1 === "token")) {
        const err6 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if (data.kind !== "flag") {
        const err7 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/1/properties/kind/const", keyword: "const", params: { allowedValue: "flag" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.token !== undefined) {
      let data2 = data.token;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err8 = { instancePath: instancePath + "/token", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/token", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
  } else {
    const err10 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  var _valid0 = _errs5 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs12 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.kind === undefined) {
        const err11 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      if (data.prefix === undefined) {
        const err12 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "prefix" }, message: "must have required property '" + "prefix" + "'" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
      for (const key2 in data) {
        if (!(key2 === "kind" || key2 === "prefix")) {
          const err13 = { instancePath, schemaPath: "#/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      }
      if (data.kind !== undefined) {
        if (data.kind !== "option") {
          const err14 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/2/properties/kind/const", keyword: "const", params: { allowedValue: "option" }, message: "must be equal to constant" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      }
      if (data.prefix !== undefined) {
        let data4 = data.prefix;
        if (typeof data4 === "string") {
          if (func2(data4) < 1) {
            const err15 = { instancePath: instancePath + "/prefix", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
            if (vErrors === null) {
              vErrors = [err15];
            } else {
              vErrors.push(err15);
            }
            errors++;
          }
        } else {
          const err16 = { instancePath: instancePath + "/prefix", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      }
    } else {
      const err17 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    var _valid0 = _errs12 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
    }
  }
  if (!valid0) {
    const err18 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err18];
    } else {
      vErrors.push(err18);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate86.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate86.evaluated = { dynamicProps: true, dynamicItems: false };
function validate85(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate85.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs2 = errors;
  let valid1 = true;
  const _errs3 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (data.type === undefined && (missing0 = "type")) {
      const err0 = {};
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    } else {
      if (data.type !== undefined) {
        if (data.type !== "select") {
          const err1 = {};
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
      }
    }
  }
  var _valid0 = _errs3 === errors;
  errors = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  let ifClause0;
  if (_valid0) {
    const _errs5 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.allowedValues === undefined) {
        const err2 = { instancePath, schemaPath: "#/allOf/0/then/required", keyword: "required", params: { missingProperty: "allowedValues" }, message: "must have required property '" + "allowedValues" + "'" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    var _valid0 = _errs5 === errors;
    valid1 = _valid0;
    if (valid1) {
      var props0 = {};
      props0.allowedValues = true;
      props0.type = true;
    }
    ifClause0 = "then";
  } else {
    const _errs6 = errors;
    const _errs7 = errors;
    const _errs8 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing1;
      if (data.allowedValues === undefined && (missing1 = "allowedValues")) {
        const err3 = {};
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    var valid3 = _errs8 === errors;
    if (valid3) {
      const err4 = { instancePath, schemaPath: "#/allOf/0/else/not", keyword: "not", params: {}, message: "must NOT be valid" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    } else {
      errors = _errs7;
      if (vErrors !== null) {
        if (_errs7) {
          vErrors.length = _errs7;
        } else {
          vErrors = null;
        }
      }
    }
    var _valid0 = _errs6 === errors;
    valid1 = _valid0;
    ifClause0 = "else";
  }
  if (!valid1) {
    const err5 = { instancePath, schemaPath: "#/allOf/0/if", keyword: "if", params: { failingKeyword: ifClause0 }, message: 'must match "' + ifClause0 + '" schema' };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  }
  const _errs10 = errors;
  let valid4 = true;
  const _errs11 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing2;
    if (data.type === undefined && (missing2 = "type")) {
      const err6 = {};
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    } else {
      if (data.type !== undefined) {
        if (data.type !== "select") {
          const err7 = {};
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      }
    }
  }
  var _valid1 = _errs11 === errors;
  errors = _errs10;
  if (vErrors !== null) {
    if (_errs10) {
      vErrors.length = _errs10;
    } else {
      vErrors = null;
    }
  }
  if (!_valid1) {
    const _errs13 = errors;
    const _errs14 = errors;
    const _errs15 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing3;
      if (data.allowedValueDescriptions === undefined && (missing3 = "allowedValueDescriptions")) {
        const err8 = {};
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    var valid6 = _errs15 === errors;
    if (valid6) {
      const err9 = { instancePath, schemaPath: "#/allOf/1/else/not", keyword: "not", params: {}, message: "must NOT be valid" };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    } else {
      errors = _errs14;
      if (vErrors !== null) {
        if (_errs14) {
          vErrors.length = _errs14;
        } else {
          vErrors = null;
        }
      }
    }
    var _valid1 = _errs13 === errors;
    valid4 = _valid1;
  }
  if (!valid4) {
    const err10 = { instancePath, schemaPath: "#/allOf/1/if", keyword: "if", params: { failingKeyword: "else" }, message: 'must match "else" schema' };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  if (props0 !== true) {
    props0 = props0 || {};
    props0.type = true;
  }
  const _errs17 = errors;
  let valid7 = true;
  const _errs18 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing4;
    if (data.type === undefined && (missing4 = "type")) {
      const err11 = {};
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    } else {
      if (data.type !== undefined) {
        if (data.type !== "number") {
          const err12 = {};
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      }
    }
  }
  var _valid2 = _errs18 === errors;
  errors = _errs17;
  if (vErrors !== null) {
    if (_errs17) {
      vErrors.length = _errs17;
    } else {
      vErrors = null;
    }
  }
  let ifClause1;
  if (_valid2) {
    const _errs20 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.defaultValue !== undefined) {
        let data3 = data.defaultValue;
        if (!(typeof data3 == "number" && isFinite(data3))) {
          const err13 = { instancePath: instancePath + "/defaultValue", schemaPath: "#/allOf/2/then/properties/defaultValue/type", keyword: "type", params: { type: "number" }, message: "must be number" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      }
    }
    var _valid2 = _errs20 === errors;
    valid7 = _valid2;
    if (valid7) {
      var props1 = {};
      props1.defaultValue = true;
      props1.type = true;
    }
    ifClause1 = "then";
  } else {
    const _errs23 = errors;
    const _errs24 = errors;
    let valid10 = true;
    const _errs25 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing5;
      if (data.type === undefined && (missing5 = "type")) {
        const err14 = {};
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      } else {
        if (data.type !== undefined) {
          if (data.type !== "boolean") {
            const err15 = {};
            if (vErrors === null) {
              vErrors = [err15];
            } else {
              vErrors.push(err15);
            }
            errors++;
          }
        }
      }
    }
    var _valid3 = _errs25 === errors;
    errors = _errs24;
    if (vErrors !== null) {
      if (_errs24) {
        vErrors.length = _errs24;
      } else {
        vErrors = null;
      }
    }
    let ifClause2;
    if (_valid3) {
      const _errs27 = errors;
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.defaultValue !== undefined) {
          if (typeof data.defaultValue !== "boolean") {
            const err16 = { instancePath: instancePath + "/defaultValue", schemaPath: "#/allOf/2/else/then/properties/defaultValue/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
        }
      }
      var _valid3 = _errs27 === errors;
      valid10 = _valid3;
      if (valid10) {
        var props2 = {};
        props2.defaultValue = true;
        props2.type = true;
      }
      ifClause2 = "then";
    } else {
      const _errs30 = errors;
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.defaultValue !== undefined) {
          if (typeof data.defaultValue !== "string") {
            const err17 = { instancePath: instancePath + "/defaultValue", schemaPath: "#/allOf/2/else/else/properties/defaultValue/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err17];
            } else {
              vErrors.push(err17);
            }
            errors++;
          }
        }
      }
      var _valid3 = _errs30 === errors;
      valid10 = _valid3;
      if (valid10) {
        if (props2 !== true) {
          props2 = props2 || {};
          props2.defaultValue = true;
        }
      }
      ifClause2 = "else";
    }
    if (!valid10) {
      const err18 = { instancePath, schemaPath: "#/allOf/2/else/if", keyword: "if", params: { failingKeyword: ifClause2 }, message: 'must match "' + ifClause2 + '" schema' };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    var _valid2 = _errs23 === errors;
    valid7 = _valid2;
    if (valid7) {
      if (props1 !== true && props2 !== undefined) {
        if (props2 === true) {
          props1 = true;
        } else {
          props1 = props1 || {};
          Object.assign(props1, props2);
        }
      }
    }
    ifClause1 = "else";
  }
  if (!valid7) {
    const err19 = { instancePath, schemaPath: "#/allOf/2/if", keyword: "if", params: { failingKeyword: ifClause1 }, message: 'must match "' + ifClause1 + '" schema' };
    if (vErrors === null) {
      vErrors = [err19];
    } else {
      vErrors.push(err19);
    }
    errors++;
  }
  if (props0 !== true && props1 !== undefined) {
    if (props1 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props1);
    }
  }
  const _errs34 = errors;
  let valid14 = true;
  const _errs35 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing6;
    if (data.emit === undefined && (missing6 = "emit")) {
      const err20 = {};
      if (vErrors === null) {
        vErrors = [err20];
      } else {
        vErrors.push(err20);
      }
      errors++;
    } else {
      if (data.emit !== undefined) {
        let data7 = data.emit;
        const _errs36 = errors;
        if (errors === _errs36) {
          if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
            let missing7;
            if (data7.kind === undefined && (missing7 = "kind")) {
              const err21 = {};
              if (vErrors === null) {
                vErrors = [err21];
              } else {
                vErrors.push(err21);
              }
              errors++;
            } else {
              if (data7.kind !== undefined) {
                if (data7.kind !== "flag") {
                  const err22 = {};
                  if (vErrors === null) {
                    vErrors = [err22];
                  } else {
                    vErrors.push(err22);
                  }
                  errors++;
                }
              }
            }
          } else {
            const err23 = {};
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
      }
    }
  }
  var _valid4 = _errs35 === errors;
  errors = _errs34;
  if (vErrors !== null) {
    if (_errs34) {
      vErrors.length = _errs34;
    } else {
      vErrors = null;
    }
  }
  if (_valid4) {
    const _errs39 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.type === undefined) {
        const err24 = { instancePath, schemaPath: "#/allOf/3/then/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property '" + "type" + "'" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
      if (data.type !== undefined) {
        if (data.type !== "boolean") {
          const err25 = { instancePath: instancePath + "/type", schemaPath: "#/allOf/3/then/properties/type/const", keyword: "const", params: { allowedValue: "boolean" }, message: "must be equal to constant" };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
      }
    }
    var _valid4 = _errs39 === errors;
    valid14 = _valid4;
    if (valid14) {
      var props3 = {};
      props3.type = true;
      props3.emit = true;
    }
  }
  if (!valid14) {
    const err26 = { instancePath, schemaPath: "#/allOf/3/if", keyword: "if", params: { failingKeyword: "then" }, message: 'must match "then" schema' };
    if (vErrors === null) {
      vErrors = [err26];
    } else {
      vErrors.push(err26);
    }
    errors++;
  }
  if (props0 !== true && props3 !== undefined) {
    if (props3 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props3);
    }
  }
  const _errs42 = errors;
  let valid18 = true;
  const _errs43 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing8;
    if (data.emit === undefined && (missing8 = "emit")) {
      const err27 = {};
      if (vErrors === null) {
        vErrors = [err27];
      } else {
        vErrors.push(err27);
      }
      errors++;
    } else {
      if (data.emit !== undefined) {
        let data10 = data.emit;
        const _errs44 = errors;
        if (errors === _errs44) {
          if (data10 && typeof data10 == "object" && !Array.isArray(data10)) {
            let missing9;
            if (data10.kind === undefined && (missing9 = "kind")) {
              const err28 = {};
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            } else {
              if (data10.kind !== undefined) {
                if (data10.kind !== "option") {
                  const err29 = {};
                  if (vErrors === null) {
                    vErrors = [err29];
                  } else {
                    vErrors.push(err29);
                  }
                  errors++;
                }
              }
            }
          } else {
            const err30 = {};
            if (vErrors === null) {
              vErrors = [err30];
            } else {
              vErrors.push(err30);
            }
            errors++;
          }
        }
      }
    }
  }
  var _valid5 = _errs43 === errors;
  errors = _errs42;
  if (vErrors !== null) {
    if (_errs42) {
      vErrors.length = _errs42;
    } else {
      vErrors = null;
    }
  }
  if (_valid5) {
    const _errs47 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.type !== undefined) {
        const _errs49 = errors;
        const _errs50 = errors;
        if (data.type !== "boolean") {
          const err31 = {};
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        var valid22 = _errs50 === errors;
        if (valid22) {
          const err32 = { instancePath: instancePath + "/type", schemaPath: "#/allOf/4/then/properties/type/not", keyword: "not", params: {}, message: "must NOT be valid" };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        } else {
          errors = _errs49;
          if (vErrors !== null) {
            if (_errs49) {
              vErrors.length = _errs49;
            } else {
              vErrors = null;
            }
          }
        }
      }
    }
    var _valid5 = _errs47 === errors;
    valid18 = _valid5;
    if (valid18) {
      var props4 = {};
      props4.type = true;
      props4.emit = true;
    }
  }
  if (!valid18) {
    const err33 = { instancePath, schemaPath: "#/allOf/4/if", keyword: "if", params: { failingKeyword: "then" }, message: 'must match "then" schema' };
    if (vErrors === null) {
      vErrors = [err33];
    } else {
      vErrors.push(err33);
    }
    errors++;
  }
  if (props0 !== true && props4 !== undefined) {
    if (props4 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props4);
    }
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.name === undefined) {
      const err34 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "name" }, message: "must have required property '" + "name" + "'" };
      if (vErrors === null) {
        vErrors = [err34];
      } else {
        vErrors.push(err34);
      }
      errors++;
    }
    if (data.placeholder === undefined) {
      const err35 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "placeholder" }, message: "must have required property '" + "placeholder" + "'" };
      if (vErrors === null) {
        vErrors = [err35];
      } else {
        vErrors.push(err35);
      }
      errors++;
    }
    if (data.description === undefined) {
      const err36 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "description" }, message: "must have required property '" + "description" + "'" };
      if (vErrors === null) {
        vErrors = [err36];
      } else {
        vErrors.push(err36);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema116.properties, key0)) {
        const err37 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
    }
    if (data.name !== undefined) {
      let data13 = data.name;
      if (typeof data13 === "string") {
        if (func2(data13) < 1) {
          const err38 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err38];
          } else {
            vErrors.push(err38);
          }
          errors++;
        }
      } else {
        const err39 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      }
    }
    if (data.placeholder !== undefined) {
      if (typeof data.placeholder !== "string") {
        const err40 = { instancePath: instancePath + "/placeholder", schemaPath: "#/properties/placeholder/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      let data15 = data.description;
      if (typeof data15 === "string") {
        if (func2(data15) < 1) {
          const err41 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
      } else {
        const err42 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err42];
        } else {
          vErrors.push(err42);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      if (typeof data.label !== "string") {
        const err43 = { instancePath: instancePath + "/label", schemaPath: "#/properties/label/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err43];
        } else {
          vErrors.push(err43);
        }
        errors++;
      }
    }
    if (data.type !== undefined) {
      let data17 = data.type;
      if (typeof data17 !== "string") {
        const err44 = { instancePath: instancePath + "/type", schemaPath: "#/properties/type/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err44];
        } else {
          vErrors.push(err44);
        }
        errors++;
      }
      if (!(data17 === "string" || data17 === "number" || data17 === "boolean" || data17 === "file-path" || data17 === "directory-path" || data17 === "select")) {
        const err45 = { instancePath: instancePath + "/type", schemaPath: "#/properties/type/enum", keyword: "enum", params: { allowedValues: schema116.properties.type.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err45];
        } else {
          vErrors.push(err45);
        }
        errors++;
      }
    }
    if (data.optional !== undefined) {
      if (typeof data.optional !== "boolean") {
        const err46 = { instancePath: instancePath + "/optional", schemaPath: "#/properties/optional/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err46];
        } else {
          vErrors.push(err46);
        }
        errors++;
      }
    }
    if (data.defaultValue !== undefined) {
      let data19 = data.defaultValue;
      if (typeof data19 !== "string" && !(typeof data19 == "number" && isFinite(data19)) && typeof data19 !== "boolean") {
        const err47 = { instancePath: instancePath + "/defaultValue", schemaPath: "#/properties/defaultValue/type", keyword: "type", params: { type: schema116.properties.defaultValue.type }, message: "must be string,number,boolean" };
        if (vErrors === null) {
          vErrors = [err47];
        } else {
          vErrors.push(err47);
        }
        errors++;
      }
    }
    if (data.allowedValues !== undefined) {
      let data20 = data.allowedValues;
      if (Array.isArray(data20)) {
        const len0 = data20.length;
        for (let i0 = 0;i0 < len0; i0++) {
          if (typeof data20[i0] !== "string") {
            const err48 = { instancePath: instancePath + "/allowedValues/" + i0, schemaPath: "#/properties/allowedValues/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err48];
            } else {
              vErrors.push(err48);
            }
            errors++;
          }
        }
      } else {
        const err49 = { instancePath: instancePath + "/allowedValues", schemaPath: "#/properties/allowedValues/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err49];
        } else {
          vErrors.push(err49);
        }
        errors++;
      }
    }
    if (data.allowedValueDescriptions !== undefined) {
      let data22 = data.allowedValueDescriptions;
      if (data22 && typeof data22 == "object" && !Array.isArray(data22)) {
        for (const key1 in data22) {
          if (typeof data22[key1] !== "string") {
            const err50 = { instancePath: instancePath + "/allowedValueDescriptions/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/allowedValueDescriptions/additionalProperties/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err50];
            } else {
              vErrors.push(err50);
            }
            errors++;
          }
        }
      } else {
        const err51 = { instancePath: instancePath + "/allowedValueDescriptions", schemaPath: "#/properties/allowedValueDescriptions/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err51];
        } else {
          vErrors.push(err51);
        }
        errors++;
      }
    }
    if (data.tier !== undefined) {
      let data24 = data.tier;
      if (typeof data24 !== "string") {
        const err52 = { instancePath: instancePath + "/tier", schemaPath: "#/properties/tier/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err52];
        } else {
          vErrors.push(err52);
        }
        errors++;
      }
      if (!(data24 === "basic" || data24 === "advanced")) {
        const err53 = { instancePath: instancePath + "/tier", schemaPath: "#/properties/tier/enum", keyword: "enum", params: { allowedValues: schema116.properties.tier.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err53];
        } else {
          vErrors.push(err53);
        }
        errors++;
      }
    }
    if (data.group !== undefined) {
      if (typeof data.group !== "string") {
        const err54 = { instancePath: instancePath + "/group", schemaPath: "#/properties/group/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err54];
        } else {
          vErrors.push(err54);
        }
        errors++;
      }
    }
    if (data.escape !== undefined) {
      if (data.escape !== "ex-argument") {
        const err55 = { instancePath: instancePath + "/escape", schemaPath: "#/properties/escape/const", keyword: "const", params: { allowedValue: "ex-argument" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err55];
        } else {
          vErrors.push(err55);
        }
        errors++;
      }
    }
    if (data.emit !== undefined) {
      if (!validate86(data.emit, { instancePath: instancePath + "/emit", parentData: data, parentDataProperty: "emit", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate86.errors : vErrors.concat(validate86.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err56 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err56];
    } else {
      vErrors.push(err56);
    }
    errors++;
  }
  validate85.errors = vErrors;
  return errors === 0;
}
validate85.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate84(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate84.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.name === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "name" }, message: "must have required property '" + "name" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.description === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "description" }, message: "must have required property '" + "description" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.template === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "template" }, message: "must have required property '" + "template" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.example === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "example" }, message: "must have required property '" + "example" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.sourceDoc === undefined) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "sourceDoc" }, message: "must have required property '" + "sourceDoc" + "'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema110.properties, key0)) {
        const err5 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.name !== undefined) {
      let data0 = data.name;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err6 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/name", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      let data1 = data.description;
      if (typeof data1 === "string") {
        if (func2(data1) < 1) {
          const err8 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.template !== undefined) {
      let data2 = data.template;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err10 = { instancePath: instancePath + "/template", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/template", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.example !== undefined) {
      let data3 = data.example;
      if (typeof data3 === "string") {
        if (func2(data3) < 1) {
          const err12 = { instancePath: instancePath + "/example", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/example", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.sourceDoc !== undefined) {
      let data4 = data.sourceDoc;
      if (typeof data4 === "string") {
        if (func2(data4) < 1) {
          const err14 = { instancePath: instancePath + "/sourceDoc", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      } else {
        const err15 = { instancePath: instancePath + "/sourceDoc", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.params !== undefined) {
      let data5 = data.params;
      if (Array.isArray(data5)) {
        const len0 = data5.length;
        for (let i0 = 0;i0 < len0; i0++) {
          if (!validate85(data5[i0], { instancePath: instancePath + "/params/" + i0, parentData: data5, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate85.errors : vErrors.concat(validate85.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err16 = { instancePath: instancePath + "/params", schemaPath: "#/properties/params/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      let data7 = data.label;
      if (typeof data7 === "string") {
        if (func2(data7) < 1) {
          const err17 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.shortDescription !== undefined) {
      let data8 = data.shortDescription;
      if (typeof data8 === "string") {
        if (func2(data8) < 1) {
          const err19 = { instancePath: instancePath + "/shortDescription", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = { instancePath: instancePath + "/shortDescription", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.category !== undefined) {
      let data9 = data.category;
      if (typeof data9 === "string") {
        if (func2(data9) < 1) {
          const err21 = { instancePath: instancePath + "/category", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      } else {
        const err22 = { instancePath: instancePath + "/category", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.whatItDoes !== undefined) {
      let data10 = data.whatItDoes;
      if (typeof data10 === "string") {
        if (func2(data10) < 1) {
          const err23 = { instancePath: instancePath + "/whatItDoes", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      } else {
        const err24 = { instancePath: instancePath + "/whatItDoes", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.technicalNote !== undefined) {
      let data11 = data.technicalNote;
      if (typeof data11 === "string") {
        if (func2(data11) < 1) {
          const err25 = { instancePath: instancePath + "/technicalNote", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
      } else {
        const err26 = { instancePath: instancePath + "/technicalNote", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.isPopular !== undefined) {
      if (typeof data.isPopular !== "boolean") {
        const err27 = { instancePath: instancePath + "/isPopular", schemaPath: "#/properties/isPopular/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.aliases !== undefined) {
      let data13 = data.aliases;
      if (Array.isArray(data13)) {
        const len1 = data13.length;
        for (let i1 = 0;i1 < len1; i1++) {
          let data14 = data13[i1];
          if (typeof data14 === "string") {
            if (func2(data14) < 1) {
              const err28 = { instancePath: instancePath + "/aliases/" + i1, schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            }
          } else {
            const err29 = { instancePath: instancePath + "/aliases/" + i1, schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err29];
            } else {
              vErrors.push(err29);
            }
            errors++;
          }
        }
      } else {
        const err30 = { instancePath: instancePath + "/aliases", schemaPath: "#/properties/aliases/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
    }
  } else {
    const err31 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err31];
    } else {
      vErrors.push(err31);
    }
    errors++;
  }
  validate84.errors = vErrors;
  return errors === 0;
}
validate84.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema128 = { type: "object", required: ["key", "baseCommandName", "label", "shortDescription", "defaults"], properties: { key: { $ref: "#/$defs/nonEmptyString" }, baseCommandName: { $ref: "#/$defs/nonEmptyString" }, label: { $ref: "#/$defs/nonEmptyString" }, shortDescription: { $ref: "#/$defs/nonEmptyString" }, defaults: { type: "object", additionalProperties: { type: ["string", "number", "boolean"] } }, example: { $ref: "#/$defs/nonEmptyString" }, whatItDoes: { type: "string" }, aliases: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } }, isPopular: { type: "boolean" } }, additionalProperties: false };
function validate90(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate90.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.key === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "key" }, message: "must have required property '" + "key" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.baseCommandName === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "baseCommandName" }, message: "must have required property '" + "baseCommandName" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.label === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property '" + "label" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.shortDescription === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "shortDescription" }, message: "must have required property '" + "shortDescription" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.defaults === undefined) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "defaults" }, message: "must have required property '" + "defaults" + "'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema128.properties, key0)) {
        const err5 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.key !== undefined) {
      let data0 = data.key;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err6 = { instancePath: instancePath + "/key", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/key", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.baseCommandName !== undefined) {
      let data1 = data.baseCommandName;
      if (typeof data1 === "string") {
        if (func2(data1) < 1) {
          const err8 = { instancePath: instancePath + "/baseCommandName", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/baseCommandName", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      let data2 = data.label;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err10 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.shortDescription !== undefined) {
      let data3 = data.shortDescription;
      if (typeof data3 === "string") {
        if (func2(data3) < 1) {
          const err12 = { instancePath: instancePath + "/shortDescription", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/shortDescription", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.defaults !== undefined) {
      let data4 = data.defaults;
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
        for (const key1 in data4) {
          let data5 = data4[key1];
          if (typeof data5 !== "string" && !(typeof data5 == "number" && isFinite(data5)) && typeof data5 !== "boolean") {
            const err14 = { instancePath: instancePath + "/defaults/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/defaults/additionalProperties/type", keyword: "type", params: { type: schema128.properties.defaults.additionalProperties.type }, message: "must be string,number,boolean" };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
        }
      } else {
        const err15 = { instancePath: instancePath + "/defaults", schemaPath: "#/properties/defaults/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.example !== undefined) {
      let data6 = data.example;
      if (typeof data6 === "string") {
        if (func2(data6) < 1) {
          const err16 = { instancePath: instancePath + "/example", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = { instancePath: instancePath + "/example", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.whatItDoes !== undefined) {
      if (typeof data.whatItDoes !== "string") {
        const err18 = { instancePath: instancePath + "/whatItDoes", schemaPath: "#/properties/whatItDoes/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.aliases !== undefined) {
      let data8 = data.aliases;
      if (Array.isArray(data8)) {
        const len0 = data8.length;
        for (let i0 = 0;i0 < len0; i0++) {
          let data9 = data8[i0];
          if (typeof data9 === "string") {
            if (func2(data9) < 1) {
              const err19 = { instancePath: instancePath + "/aliases/" + i0, schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err19];
              } else {
                vErrors.push(err19);
              }
              errors++;
            }
          } else {
            const err20 = { instancePath: instancePath + "/aliases/" + i0, schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        }
      } else {
        const err21 = { instancePath: instancePath + "/aliases", schemaPath: "#/properties/aliases/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.isPopular !== undefined) {
      if (typeof data.isPopular !== "boolean") {
        const err22 = { instancePath: instancePath + "/isPopular", schemaPath: "#/properties/isPopular/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
  } else {
    const err23 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err23];
    } else {
      vErrors.push(err23);
    }
    errors++;
  }
  validate90.errors = vErrors;
  return errors === 0;
}
validate90.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate92(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate92.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.key === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "key" }, message: "must have required property '" + "key" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.baseFunctionName === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "baseFunctionName" }, message: "must have required property '" + "baseFunctionName" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.label === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property '" + "label" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.shortDescription === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "shortDescription" }, message: "must have required property '" + "shortDescription" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.defaults === undefined) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "defaults" }, message: "must have required property '" + "defaults" + "'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "key" || key0 === "baseFunctionName" || key0 === "label" || key0 === "shortDescription" || key0 === "whatItDoes" || key0 === "defaults" || key0 === "aliases" || key0 === "isPopular")) {
        const err5 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.key !== undefined) {
      let data0 = data.key;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err6 = { instancePath: instancePath + "/key", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/key", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.baseFunctionName !== undefined) {
      let data1 = data.baseFunctionName;
      if (typeof data1 === "string") {
        if (func2(data1) < 1) {
          const err8 = { instancePath: instancePath + "/baseFunctionName", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/baseFunctionName", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.label !== undefined) {
      let data2 = data.label;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err10 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.shortDescription !== undefined) {
      let data3 = data.shortDescription;
      if (typeof data3 === "string") {
        if (func2(data3) < 1) {
          const err12 = { instancePath: instancePath + "/shortDescription", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/shortDescription", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.whatItDoes !== undefined) {
      if (typeof data.whatItDoes !== "string") {
        const err14 = { instancePath: instancePath + "/whatItDoes", schemaPath: "#/properties/whatItDoes/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.defaults !== undefined) {
      let data5 = data.defaults;
      if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
        for (const key1 in data5) {
          if (!validate80(data5[key1], { instancePath: instancePath + "/defaults/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"), parentData: data5, parentDataProperty: key1, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate80.errors : vErrors.concat(validate80.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err15 = { instancePath: instancePath + "/defaults", schemaPath: "#/properties/defaults/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.aliases !== undefined) {
      let data7 = data.aliases;
      if (Array.isArray(data7)) {
        const len0 = data7.length;
        for (let i0 = 0;i0 < len0; i0++) {
          let data8 = data7[i0];
          if (typeof data8 === "string") {
            if (func2(data8) < 1) {
              const err16 = { instancePath: instancePath + "/aliases/" + i0, schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err16];
              } else {
                vErrors.push(err16);
              }
              errors++;
            }
          } else {
            const err17 = { instancePath: instancePath + "/aliases/" + i0, schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err17];
            } else {
              vErrors.push(err17);
            }
            errors++;
          }
        }
      } else {
        const err18 = { instancePath: instancePath + "/aliases", schemaPath: "#/properties/aliases/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.isPopular !== undefined) {
      if (typeof data.isPopular !== "boolean") {
        const err19 = { instancePath: instancePath + "/isPopular", schemaPath: "#/properties/isPopular/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
  } else {
    const err20 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err20];
    } else {
      vErrors.push(err20);
    }
    errors++;
  }
  validate92.errors = vErrors;
  return errors === 0;
}
validate92.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema141 = { oneOf: [{ type: "object", required: ["kind", "left", "right", "severity", "message"], properties: { kind: { const: "conflict" }, left: { $ref: "#/$defs/nonEmptyString" }, right: { $ref: "#/$defs/nonEmptyString" }, severity: { type: "string", enum: ["warning", "error"] }, when: { type: "string", enum: ["both-explicit", "both-meaningful"] }, message: { $ref: "#/$defs/nonEmptyString" } }, additionalProperties: false }, { type: "object", required: ["kind", "scope", "when", "action"], properties: { kind: { const: "subtree-gate" }, scope: { $ref: "#/$defs/nonBlankString" }, when: { $ref: "#/$defs/condition" }, action: { const: "omit-subtree" }, warnOnExplicitDescendants: { type: "boolean" }, message: { $ref: "#/$defs/nonEmptyString" } }, additionalProperties: false }, { type: "object", required: ["kind", "scope", "mode"], properties: { kind: { const: "subtree-filter" }, scope: { $ref: "#/$defs/nonBlankString" }, mode: { const: "meaningful-only" }, preserveKeys: { type: "array", items: { $ref: "#/$defs/nonEmptyString" } } }, additionalProperties: false }] };
function validate95(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate95.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.left === undefined) {
      const err1 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "left" }, message: "must have required property '" + "left" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.right === undefined) {
      const err2 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "right" }, message: "must have required property '" + "right" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.severity === undefined) {
      const err3 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "severity" }, message: "must have required property '" + "severity" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.message === undefined) {
      const err4 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "message" }, message: "must have required property '" + "message" + "'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "kind" || key0 === "left" || key0 === "right" || key0 === "severity" || key0 === "when" || key0 === "message")) {
        const err5 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if (data.kind !== "conflict") {
        const err6 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/0/properties/kind/const", keyword: "const", params: { allowedValue: "conflict" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.left !== undefined) {
      let data1 = data.left;
      if (typeof data1 === "string") {
        if (func2(data1) < 1) {
          const err7 = { instancePath: instancePath + "/left", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/left", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.right !== undefined) {
      let data2 = data.right;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err9 = { instancePath: instancePath + "/right", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = { instancePath: instancePath + "/right", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.severity !== undefined) {
      let data3 = data.severity;
      if (typeof data3 !== "string") {
        const err11 = { instancePath: instancePath + "/severity", schemaPath: "#/oneOf/0/properties/severity/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      if (!(data3 === "warning" || data3 === "error")) {
        const err12 = { instancePath: instancePath + "/severity", schemaPath: "#/oneOf/0/properties/severity/enum", keyword: "enum", params: { allowedValues: schema141.oneOf[0].properties.severity.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.when !== undefined) {
      let data4 = data.when;
      if (typeof data4 !== "string") {
        const err13 = { instancePath: instancePath + "/when", schemaPath: "#/oneOf/0/properties/when/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
      if (!(data4 === "both-explicit" || data4 === "both-meaningful")) {
        const err14 = { instancePath: instancePath + "/when", schemaPath: "#/oneOf/0/properties/when/enum", keyword: "enum", params: { allowedValues: schema141.oneOf[0].properties.when.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.message !== undefined) {
      let data5 = data.message;
      if (typeof data5 === "string") {
        if (func2(data5) < 1) {
          const err15 = { instancePath: instancePath + "/message", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = { instancePath: instancePath + "/message", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
  } else {
    const err17 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err17];
    } else {
      vErrors.push(err17);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs18 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err18 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    if (data.scope === undefined) {
      const err19 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "scope" }, message: "must have required property '" + "scope" + "'" };
      if (vErrors === null) {
        vErrors = [err19];
      } else {
        vErrors.push(err19);
      }
      errors++;
    }
    if (data.when === undefined) {
      const err20 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "when" }, message: "must have required property '" + "when" + "'" };
      if (vErrors === null) {
        vErrors = [err20];
      } else {
        vErrors.push(err20);
      }
      errors++;
    }
    if (data.action === undefined) {
      const err21 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "action" }, message: "must have required property '" + "action" + "'" };
      if (vErrors === null) {
        vErrors = [err21];
      } else {
        vErrors.push(err21);
      }
      errors++;
    }
    for (const key1 in data) {
      if (!(key1 === "kind" || key1 === "scope" || key1 === "when" || key1 === "action" || key1 === "warnOnExplicitDescendants" || key1 === "message")) {
        const err22 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if (data.kind !== "subtree-gate") {
        const err23 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/1/properties/kind/const", keyword: "const", params: { allowedValue: "subtree-gate" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.scope !== undefined) {
      let data7 = data.scope;
      if (typeof data7 === "string") {
        if (!pattern6.test(data7)) {
          const err24 = { instancePath: instancePath + "/scope", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
      } else {
        const err25 = { instancePath: instancePath + "/scope", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
    }
    if (data.when !== undefined) {
      if (!validate25(data.when, { instancePath: instancePath + "/when", parentData: data, parentDataProperty: "when", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
        errors = vErrors.length;
      }
    }
    if (data.action !== undefined) {
      if (data.action !== "omit-subtree") {
        const err26 = { instancePath: instancePath + "/action", schemaPath: "#/oneOf/1/properties/action/const", keyword: "const", params: { allowedValue: "omit-subtree" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.warnOnExplicitDescendants !== undefined) {
      if (typeof data.warnOnExplicitDescendants !== "boolean") {
        const err27 = { instancePath: instancePath + "/warnOnExplicitDescendants", schemaPath: "#/oneOf/1/properties/warnOnExplicitDescendants/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.message !== undefined) {
      let data11 = data.message;
      if (typeof data11 === "string") {
        if (func2(data11) < 1) {
          const err28 = { instancePath: instancePath + "/message", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
      } else {
        const err29 = { instancePath: instancePath + "/message", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
  } else {
    const err30 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err30];
    } else {
      vErrors.push(err30);
    }
    errors++;
  }
  var _valid0 = _errs18 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs32 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.kind === undefined) {
        const err31 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
        if (vErrors === null) {
          vErrors = [err31];
        } else {
          vErrors.push(err31);
        }
        errors++;
      }
      if (data.scope === undefined) {
        const err32 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "scope" }, message: "must have required property '" + "scope" + "'" };
        if (vErrors === null) {
          vErrors = [err32];
        } else {
          vErrors.push(err32);
        }
        errors++;
      }
      if (data.mode === undefined) {
        const err33 = { instancePath, schemaPath: "#/oneOf/2/required", keyword: "required", params: { missingProperty: "mode" }, message: "must have required property '" + "mode" + "'" };
        if (vErrors === null) {
          vErrors = [err33];
        } else {
          vErrors.push(err33);
        }
        errors++;
      }
      for (const key2 in data) {
        if (!(key2 === "kind" || key2 === "scope" || key2 === "mode" || key2 === "preserveKeys")) {
          const err34 = { instancePath, schemaPath: "#/oneOf/2/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
      }
      if (data.kind !== undefined) {
        if (data.kind !== "subtree-filter") {
          const err35 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/2/properties/kind/const", keyword: "const", params: { allowedValue: "subtree-filter" }, message: "must be equal to constant" };
          if (vErrors === null) {
            vErrors = [err35];
          } else {
            vErrors.push(err35);
          }
          errors++;
        }
      }
      if (data.scope !== undefined) {
        let data13 = data.scope;
        if (typeof data13 === "string") {
          if (!pattern6.test(data13)) {
            const err36 = { instancePath: instancePath + "/scope", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
            if (vErrors === null) {
              vErrors = [err36];
            } else {
              vErrors.push(err36);
            }
            errors++;
          }
        } else {
          const err37 = { instancePath: instancePath + "/scope", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
      }
      if (data.mode !== undefined) {
        if (data.mode !== "meaningful-only") {
          const err38 = { instancePath: instancePath + "/mode", schemaPath: "#/oneOf/2/properties/mode/const", keyword: "const", params: { allowedValue: "meaningful-only" }, message: "must be equal to constant" };
          if (vErrors === null) {
            vErrors = [err38];
          } else {
            vErrors.push(err38);
          }
          errors++;
        }
      }
      if (data.preserveKeys !== undefined) {
        let data15 = data.preserveKeys;
        if (Array.isArray(data15)) {
          const len0 = data15.length;
          for (let i0 = 0;i0 < len0; i0++) {
            let data16 = data15[i0];
            if (typeof data16 === "string") {
              if (func2(data16) < 1) {
                const err39 = { instancePath: instancePath + "/preserveKeys/" + i0, schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                if (vErrors === null) {
                  vErrors = [err39];
                } else {
                  vErrors.push(err39);
                }
                errors++;
              }
            } else {
              const err40 = { instancePath: instancePath + "/preserveKeys/" + i0, schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
              if (vErrors === null) {
                vErrors = [err40];
              } else {
                vErrors.push(err40);
              }
              errors++;
            }
          }
        } else {
          const err41 = { instancePath: instancePath + "/preserveKeys", schemaPath: "#/oneOf/2/properties/preserveKeys/type", keyword: "type", params: { type: "array" }, message: "must be array" };
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
      }
    } else {
      const err42 = { instancePath, schemaPath: "#/oneOf/2/type", keyword: "type", params: { type: "object" }, message: "must be object" };
      if (vErrors === null) {
        vErrors = [err42];
      } else {
        vErrors.push(err42);
      }
      errors++;
    }
    var _valid0 = _errs32 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
    }
  }
  if (!valid0) {
    const err43 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err43];
    } else {
      vErrors.push(err43);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate95.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate95.evaluated = { dynamicProps: true, dynamicItems: false };
function validate98(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate98.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.provider === undefined) {
      const err1 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "provider" }, message: "must have required property '" + "provider" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "kind" || key0 === "provider")) {
        const err2 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if (data.kind !== "lsp-package-installer") {
        const err3 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/0/properties/kind/const", keyword: "const", params: { allowedValue: "lsp-package-installer" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.provider !== undefined) {
      if (data.provider !== "mason-registry") {
        const err4 = { instancePath: instancePath + "/provider", schemaPath: "#/oneOf/0/properties/provider/const", keyword: "const", params: { allowedValue: "mason-registry" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
  } else {
    const err5 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs6 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err6 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.api === undefined) {
      const err7 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "api" }, message: "must have required property '" + "api" + "'" };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.minNvimVersion === undefined) {
      const err8 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "minNvimVersion" }, message: "must have required property '" + "minNvimVersion" + "'" };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    for (const key1 in data) {
      if (!(key1 === "kind" || key1 === "api" || key1 === "minNvimVersion")) {
        const err9 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.kind !== undefined) {
      if (data.kind !== "lsp-server-enabler") {
        const err10 = { instancePath: instancePath + "/kind", schemaPath: "#/oneOf/1/properties/kind/const", keyword: "const", params: { allowedValue: "lsp-server-enabler" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.api !== undefined) {
      if (data.api !== "vim.lsp.enable") {
        const err11 = { instancePath: instancePath + "/api", schemaPath: "#/oneOf/1/properties/api/const", keyword: "const", params: { allowedValue: "vim.lsp.enable" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.minNvimVersion !== undefined) {
      let data4 = data.minNvimVersion;
      if (typeof data4 === "string") {
        if (func2(data4) < 1) {
          const err12 = { instancePath: instancePath + "/minNvimVersion", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/minNvimVersion", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
  } else {
    const err14 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  var _valid0 = _errs6 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
  }
  if (!valid0) {
    const err15 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err15];
    } else {
      vErrors.push(err15);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate98.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate98.evaluated = { dynamicProps: true, dynamicItems: false };
var schema151 = { oneOf: [{ type: "object", required: ["requirePath"], properties: { requirePath: { $ref: "#/$defs/nonBlankString" }, setupFunction: { $ref: "#/$defs/nonBlankString" }, optionMapping: { type: "string", enum: ["table", "individual"] }, preSetup: { type: "string" }, postSetup: { type: "string" } }, additionalProperties: false }, { type: "object", required: ["requirePath", "render"], properties: { requirePath: { $ref: "#/$defs/nonBlankString" }, preSetup: { type: "string" }, postSetup: { type: "string" }, render: { type: "object", required: ["kind", "template"], properties: { kind: { const: "lua-template" }, template: { $ref: "#/$defs/nonBlankString" } }, additionalProperties: false } }, additionalProperties: false }], description: "Optional plugin startup setup metadata. Raw Lua fields are trusted author content." };
function validate100(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate100.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.requirePath === undefined) {
      const err0 = { instancePath, schemaPath: "#/oneOf/0/required", keyword: "required", params: { missingProperty: "requirePath" }, message: "must have required property '" + "requirePath" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "requirePath" || key0 === "setupFunction" || key0 === "optionMapping" || key0 === "preSetup" || key0 === "postSetup")) {
        const err1 = { instancePath, schemaPath: "#/oneOf/0/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.requirePath !== undefined) {
      let data0 = data.requirePath;
      if (typeof data0 === "string") {
        if (!pattern6.test(data0)) {
          const err2 = { instancePath: instancePath + "/requirePath", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
      } else {
        const err3 = { instancePath: instancePath + "/requirePath", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.setupFunction !== undefined) {
      let data1 = data.setupFunction;
      if (typeof data1 === "string") {
        if (!pattern6.test(data1)) {
          const err4 = { instancePath: instancePath + "/setupFunction", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/setupFunction", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.optionMapping !== undefined) {
      let data2 = data.optionMapping;
      if (typeof data2 !== "string") {
        const err6 = { instancePath: instancePath + "/optionMapping", schemaPath: "#/oneOf/0/properties/optionMapping/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
      if (!(data2 === "table" || data2 === "individual")) {
        const err7 = { instancePath: instancePath + "/optionMapping", schemaPath: "#/oneOf/0/properties/optionMapping/enum", keyword: "enum", params: { allowedValues: schema151.oneOf[0].properties.optionMapping.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.preSetup !== undefined) {
      if (typeof data.preSetup !== "string") {
        const err8 = { instancePath: instancePath + "/preSetup", schemaPath: "#/oneOf/0/properties/preSetup/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.postSetup !== undefined) {
      if (typeof data.postSetup !== "string") {
        const err9 = { instancePath: instancePath + "/postSetup", schemaPath: "#/oneOf/0/properties/postSetup/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
  } else {
    const err10 = { instancePath, schemaPath: "#/oneOf/0/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs16 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.requirePath === undefined) {
      const err11 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "requirePath" }, message: "must have required property '" + "requirePath" + "'" };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.render === undefined) {
      const err12 = { instancePath, schemaPath: "#/oneOf/1/required", keyword: "required", params: { missingProperty: "render" }, message: "must have required property '" + "render" + "'" };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    for (const key1 in data) {
      if (!(key1 === "requirePath" || key1 === "preSetup" || key1 === "postSetup" || key1 === "render")) {
        const err13 = { instancePath, schemaPath: "#/oneOf/1/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.requirePath !== undefined) {
      let data5 = data.requirePath;
      if (typeof data5 === "string") {
        if (!pattern6.test(data5)) {
          const err14 = { instancePath: instancePath + "/requirePath", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      } else {
        const err15 = { instancePath: instancePath + "/requirePath", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.preSetup !== undefined) {
      if (typeof data.preSetup !== "string") {
        const err16 = { instancePath: instancePath + "/preSetup", schemaPath: "#/oneOf/1/properties/preSetup/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.postSetup !== undefined) {
      if (typeof data.postSetup !== "string") {
        const err17 = { instancePath: instancePath + "/postSetup", schemaPath: "#/oneOf/1/properties/postSetup/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.render !== undefined) {
      let data8 = data.render;
      if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
        if (data8.kind === undefined) {
          const err18 = { instancePath: instancePath + "/render", schemaPath: "#/oneOf/1/properties/render/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property '" + "kind" + "'" };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (data8.template === undefined) {
          const err19 = { instancePath: instancePath + "/render", schemaPath: "#/oneOf/1/properties/render/required", keyword: "required", params: { missingProperty: "template" }, message: "must have required property '" + "template" + "'" };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        for (const key2 in data8) {
          if (!(key2 === "kind" || key2 === "template")) {
            const err20 = { instancePath: instancePath + "/render", schemaPath: "#/oneOf/1/properties/render/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        }
        if (data8.kind !== undefined) {
          if (data8.kind !== "lua-template") {
            const err21 = { instancePath: instancePath + "/render/kind", schemaPath: "#/oneOf/1/properties/render/properties/kind/const", keyword: "const", params: { allowedValue: "lua-template" }, message: "must be equal to constant" };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          }
        }
        if (data8.template !== undefined) {
          let data10 = data8.template;
          if (typeof data10 === "string") {
            if (!pattern6.test(data10)) {
              const err22 = { instancePath: instancePath + "/render/template", schemaPath: "#/$defs/nonBlankString/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "' + "\\S" + '"' };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors++;
            }
          } else {
            const err23 = { instancePath: instancePath + "/render/template", schemaPath: "#/$defs/nonBlankString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
      } else {
        const err24 = { instancePath: instancePath + "/render", schemaPath: "#/oneOf/1/properties/render/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
  } else {
    const err25 = { instancePath, schemaPath: "#/oneOf/1/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err25];
    } else {
      vErrors.push(err25);
    }
    errors++;
  }
  var _valid0 = _errs16 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
  }
  if (!valid0) {
    const err26 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
      vErrors = [err26];
    } else {
      vErrors.push(err26);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate100.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate100.evaluated = { dynamicProps: true, dynamicItems: false };
function validate20(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === undefined) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property '" + "id" + "'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.pluginName === undefined) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "pluginName" }, message: "must have required property '" + "pluginName" + "'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.pluginRepo === undefined) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "pluginRepo" }, message: "must have required property '" + "pluginRepo" + "'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.version === undefined) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "version" }, message: "must have required property '" + "version" + "'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.options === undefined) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "options" }, message: "must have required property '" + "options" + "'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.functions === undefined) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "functions" }, message: "must have required property '" + "functions" + "'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema31.properties, key0)) {
        const err6 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.$schema !== undefined) {
      let data0 = data.$schema;
      if (typeof data0 === "string") {
        if (!formats0(data0)) {
          const err7 = { instancePath: instancePath + "/$schema", schemaPath: "#/properties/%24schema/format", keyword: "format", params: { format: "uri" }, message: 'must match format "' + "uri" + '"' };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/$schema", schemaPath: "#/properties/%24schema/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.id !== undefined) {
      let data1 = data.id;
      if (typeof data1 === "string") {
        if (func2(data1) < 1) {
          const err9 = { instancePath: instancePath + "/id", schemaPath: "#/properties/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (!pattern4.test(data1)) {
          const err10 = { instancePath: instancePath + "/id", schemaPath: "#/properties/id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*(?::[A-Za-z0-9][A-Za-z0-9._/-]*)?$" }, message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._-]*(?::[A-Za-z0-9][A-Za-z0-9._/-]*)?$" + '"' };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/id", schemaPath: "#/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.pluginName !== undefined) {
      let data2 = data.pluginName;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err12 = { instancePath: instancePath + "/pluginName", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/pluginName", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.pluginRepo !== undefined) {
      let data3 = data.pluginRepo;
      if (typeof data3 === "string") {
        if (!pattern5.test(data3)) {
          const err14 = { instancePath: instancePath + "/pluginRepo", schemaPath: "#/properties/pluginRepo/pattern", keyword: "pattern", params: { pattern: "^https?://" }, message: 'must match pattern "' + "^https?://" + '"' };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (!formats0(data3)) {
          const err15 = { instancePath: instancePath + "/pluginRepo", schemaPath: "#/properties/pluginRepo/format", keyword: "format", params: { format: "uri" }, message: 'must match format "' + "uri" + '"' };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = { instancePath: instancePath + "/pluginRepo", schemaPath: "#/properties/pluginRepo/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.version !== undefined) {
      let data4 = data.version;
      if (typeof data4 === "string") {
        if (func2(data4) < 1) {
          const err17 = { instancePath: instancePath + "/version", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = { instancePath: instancePath + "/version", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      if (typeof data.description !== "string") {
        const err19 = { instancePath: instancePath + "/description", schemaPath: "#/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.pack !== undefined) {
      if (!validate21(data.pack, { instancePath: instancePath + "/pack", parentData: data, parentDataProperty: "pack", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
        errors = vErrors.length;
      }
    }
    if (data.dependencies !== undefined) {
      let data7 = data.dependencies;
      if (Array.isArray(data7)) {
        const len0 = data7.length;
        for (let i0 = 0;i0 < len0; i0++) {
          let data8 = data7[i0];
          if (typeof data8 === "string") {
            if (func2(data8) < 1) {
              const err20 = { instancePath: instancePath + "/dependencies/" + i0, schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
            }
          } else {
            const err21 = { instancePath: instancePath + "/dependencies/" + i0, schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          }
        }
      } else {
        const err22 = { instancePath: instancePath + "/dependencies", schemaPath: "#/properties/dependencies/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.options !== undefined) {
      let data9 = data.options;
      if (Array.isArray(data9)) {
        const len1 = data9.length;
        for (let i1 = 0;i1 < len1; i1++) {
          if (!validate23(data9[i1], { instancePath: instancePath + "/options/" + i1, parentData: data9, parentDataProperty: i1, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err23 = { instancePath: instancePath + "/options", schemaPath: "#/properties/options/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.functions !== undefined) {
      let data11 = data.functions;
      if (Array.isArray(data11)) {
        const len2 = data11.length;
        for (let i2 = 0;i2 < len2; i2++) {
          if (!validate78(data11[i2], { instancePath: instancePath + "/functions/" + i2, parentData: data11, parentDataProperty: i2, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate78.errors : vErrors.concat(validate78.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err24 = { instancePath: instancePath + "/functions", schemaPath: "#/properties/functions/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.events !== undefined) {
      let data13 = data.events;
      if (Array.isArray(data13)) {
        const len3 = data13.length;
        for (let i3 = 0;i3 < len3; i3++) {
          let data14 = data13[i3];
          if (typeof data14 === "string") {
            if (func2(data14) < 1) {
              const err25 = { instancePath: instancePath + "/events/" + i3, schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err25];
              } else {
                vErrors.push(err25);
              }
              errors++;
            }
          } else {
            const err26 = { instancePath: instancePath + "/events/" + i3, schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
        }
      } else {
        const err27 = { instancePath: instancePath + "/events", schemaPath: "#/properties/events/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.exCommands !== undefined) {
      let data15 = data.exCommands;
      if (Array.isArray(data15)) {
        const len4 = data15.length;
        for (let i4 = 0;i4 < len4; i4++) {
          if (!validate84(data15[i4], { instancePath: instancePath + "/exCommands/" + i4, parentData: data15, parentDataProperty: i4, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate84.errors : vErrors.concat(validate84.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err28 = { instancePath: instancePath + "/exCommands", schemaPath: "#/properties/exCommands/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.exCommandTemplates !== undefined) {
      let data17 = data.exCommandTemplates;
      if (Array.isArray(data17)) {
        const len5 = data17.length;
        for (let i5 = 0;i5 < len5; i5++) {
          if (!validate90(data17[i5], { instancePath: instancePath + "/exCommandTemplates/" + i5, parentData: data17, parentDataProperty: i5, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate90.errors : vErrors.concat(validate90.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err29 = { instancePath: instancePath + "/exCommandTemplates", schemaPath: "#/properties/exCommandTemplates/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.functionTemplates !== undefined) {
      let data19 = data.functionTemplates;
      if (Array.isArray(data19)) {
        const len6 = data19.length;
        for (let i6 = 0;i6 < len6; i6++) {
          if (!validate92(data19[i6], { instancePath: instancePath + "/functionTemplates/" + i6, parentData: data19, parentDataProperty: i6, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate92.errors : vErrors.concat(validate92.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err30 = { instancePath: instancePath + "/functionTemplates", schemaPath: "#/properties/functionTemplates/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
    }
    if (data.generationRules !== undefined) {
      let data21 = data.generationRules;
      if (Array.isArray(data21)) {
        const len7 = data21.length;
        for (let i7 = 0;i7 < len7; i7++) {
          if (!validate95(data21[i7], { instancePath: instancePath + "/generationRules/" + i7, parentData: data21, parentDataProperty: i7, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate95.errors : vErrors.concat(validate95.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err31 = { instancePath: instancePath + "/generationRules", schemaPath: "#/properties/generationRules/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err31];
        } else {
          vErrors.push(err31);
        }
        errors++;
      }
    }
    if (data.capabilities !== undefined) {
      let data23 = data.capabilities;
      if (Array.isArray(data23)) {
        const len8 = data23.length;
        for (let i8 = 0;i8 < len8; i8++) {
          if (!validate98(data23[i8], { instancePath: instancePath + "/capabilities/" + i8, parentData: data23, parentDataProperty: i8, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate98.errors : vErrors.concat(validate98.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err32 = { instancePath: instancePath + "/capabilities", schemaPath: "#/properties/capabilities/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err32];
        } else {
          vErrors.push(err32);
        }
        errors++;
      }
    }
    if (data.setup !== undefined) {
      if (!validate100(data.setup, { instancePath: instancePath + "/setup", parentData: data, parentDataProperty: "setup", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate100.errors : vErrors.concat(validate100.errors);
        errors = vErrors.length;
      }
    }
    if (data.author !== undefined) {
      let data26 = data.author;
      if (typeof data26 === "string") {
        if (func2(data26) < 1) {
          const err33 = { instancePath: instancePath + "/author", schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
      } else {
        const err34 = { instancePath: instancePath + "/author", schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err34];
        } else {
          vErrors.push(err34);
        }
        errors++;
      }
    }
    if (data.stars !== undefined) {
      let data27 = data.stars;
      if (!(typeof data27 == "number" && (!(data27 % 1) && !isNaN(data27)) && isFinite(data27))) {
        const err35 = { instancePath: instancePath + "/stars", schemaPath: "#/properties/stars/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
      if (typeof data27 == "number" && isFinite(data27)) {
        if (data27 < 0 || isNaN(data27)) {
          const err36 = { instancePath: instancePath + "/stars", schemaPath: "#/properties/stars/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
          if (vErrors === null) {
            vErrors = [err36];
          } else {
            vErrors.push(err36);
          }
          errors++;
        }
      }
    }
    if (data.category !== undefined) {
      let data28 = data.category;
      if (typeof data28 !== "string") {
        const err37 = { instancePath: instancePath + "/category", schemaPath: "#/$defs/pluginCategory/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
      if (!(data28 === "editor" || data28 === "lsp" || data28 === "ui" || data28 === "navigation" || data28 === "git" || data28 === "debugging" || data28 === "syntax" || data28 === "utility")) {
        const err38 = { instancePath: instancePath + "/category", schemaPath: "#/$defs/pluginCategory/enum", keyword: "enum", params: { allowedValues: schema157.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
    }
    if (data.tags !== undefined) {
      let data29 = data.tags;
      if (Array.isArray(data29)) {
        const len9 = data29.length;
        for (let i9 = 0;i9 < len9; i9++) {
          let data30 = data29[i9];
          if (typeof data30 === "string") {
            if (func2(data30) < 1) {
              const err39 = { instancePath: instancePath + "/tags/" + i9, schemaPath: "#/$defs/nonEmptyString/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err39];
              } else {
                vErrors.push(err39);
              }
              errors++;
            }
          } else {
            const err40 = { instancePath: instancePath + "/tags/" + i9, schemaPath: "#/$defs/nonEmptyString/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err40];
            } else {
              vErrors.push(err40);
            }
            errors++;
          }
        }
      } else {
        const err41 = { instancePath: instancePath + "/tags", schemaPath: "#/properties/tags/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err41];
        } else {
          vErrors.push(err41);
        }
        errors++;
      }
    }
    if (data.tagline !== undefined) {
      let data31 = data.tagline;
      if (typeof data31 === "string") {
        if (func2(data31) > 120) {
          const err42 = { instancePath: instancePath + "/tagline", schemaPath: "#/properties/tagline/maxLength", keyword: "maxLength", params: { limit: 120 }, message: "must NOT have more than 120 characters" };
          if (vErrors === null) {
            vErrors = [err42];
          } else {
            vErrors.push(err42);
          }
          errors++;
        }
        if (func2(data31) < 1) {
          const err43 = { instancePath: instancePath + "/tagline", schemaPath: "#/properties/tagline/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err43];
          } else {
            vErrors.push(err43);
          }
          errors++;
        }
      } else {
        const err44 = { instancePath: instancePath + "/tagline", schemaPath: "#/properties/tagline/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err44];
        } else {
          vErrors.push(err44);
        }
        errors++;
      }
    }
    if (data.iconUrl !== undefined) {
      let data32 = data.iconUrl;
      if (typeof data32 === "string") {
        if (!pattern5.test(data32)) {
          const err45 = { instancePath: instancePath + "/iconUrl", schemaPath: "#/properties/iconUrl/pattern", keyword: "pattern", params: { pattern: "^https?://" }, message: 'must match pattern "' + "^https?://" + '"' };
          if (vErrors === null) {
            vErrors = [err45];
          } else {
            vErrors.push(err45);
          }
          errors++;
        }
        if (!formats0(data32)) {
          const err46 = { instancePath: instancePath + "/iconUrl", schemaPath: "#/properties/iconUrl/format", keyword: "format", params: { format: "uri" }, message: 'must match format "' + "uri" + '"' };
          if (vErrors === null) {
            vErrors = [err46];
          } else {
            vErrors.push(err46);
          }
          errors++;
        }
      } else {
        const err47 = { instancePath: instancePath + "/iconUrl", schemaPath: "#/properties/iconUrl/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err47];
        } else {
          vErrors.push(err47);
        }
        errors++;
      }
    }
  } else {
    const err48 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err48];
    } else {
      vErrors.push(err48);
    }
    errors++;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export {
  validatePluginSchemaStructure
};
