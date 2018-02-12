import * as utils from 'src/utils';
import { registerBidder } from 'src/adapters/bidderFactory';
const constants = require('src/constants.json');
// adding adapter specific constants 
constants.REQUEST_KEYS = {
  'PROFILEID': 'profId',
  'VERSIONID': 'verId',
  'GENDER': 'gender',
  'LAT': 'lat',
  'LON': 'lon',
  'YOB': 'yob',
  'WIID': 'wiid',
  'DCTR': 'dctr',
  'KADFLOOR': 'kadfloor',
  'PMZONEID': 'pmzoneid',
  'KADPAGEURL': 'kadpageurl',
  'PUBLISHERID': 'publisherId',
  'ADSLOTID': 'adSlotId'
};
constants.ERROR_MSG = {
  'MANDATORY_PARAM': '{%param_name} is mandatory and cannot be {%data_type}. Call to OpenBid will not be sent.',
  'SKIP_NONSTD_ADSLOT': 'Skipping the non-standard adSlot - {%adSlot} in bid \n {%bid}',
  'IGNORE_PARAM': 'Ignoring param key - \'{%param_name}\' with value \'{%value}\'. Expects string-value, found - \'{%data_type}\'',
  'ADSLOT_FORMAT_ERROR': 'AdSlot Error: adSlot not in required format',
  'ENABLE_IFRAME_SYNC': 'Please enable iframe based user sync.'
};
constants.DATA_TYPE = {
  'NUMERIC': 'numeric',
  'STRING': 'string'
}
const BIDDER_CODE = 'pubmatic';
const ENDPOINT = '//hbopenbid.pubmatic.com/translator?source=prebid-client';
const USYNCURL = '//ads.pubmatic.com/AdServer/js/showad.js#PIX&kdntuid=1&p=';
const CURRENCY = 'USD';
const AUCTION_TYPE = 1;
const UNDEFINED = undefined;
const CUSTOM_PARAMS = {};
CUSTOM_PARAMS[constants.REQUEST_KEYS.KADPAGEURL] = ''; // Custom page url
CUSTOM_PARAMS[constants.REQUEST_KEYS.GENDER] = ''; // User gender
CUSTOM_PARAMS[constants.REQUEST_KEYS.YOB] = ''; // User year of birth
CUSTOM_PARAMS[constants.REQUEST_KEYS.LAT] = ''; // User location - Latitude
CUSTOM_PARAMS[constants.REQUEST_KEYS.LON] = ''; // User Location - Longitude
CUSTOM_PARAMS[constants.REQUEST_KEYS.WIID] = ''; // OpenWrap Wrapper Impression ID
CUSTOM_PARAMS[constants.REQUEST_KEYS.PROFILEID] = ''; // OpenWrap Legacy: Profile ID
CUSTOM_PARAMS[constants.REQUEST_KEYS.VERSIONID] = ''; // OpenWrap Legacy: version ID
CUSTOM_PARAMS[constants.REQUEST_KEYS.DCTR] = ''; // Custom Targeting
const NET_REVENUE = false;

let publisherId = 0;
/*
Util function to log custom messages.
  msg - msg string
  dataObj - values to replace macros in the string (optional)
  eg:
  msg = '{%param_name} is mandatory and cannot be {%data_type}. Call to OpenBid will not be sent.'
  correspinding dataObj -
    {
      param_name: 'adSlotId',
      data_type: 'numeric'
    }
  return value = 'PubMatic Error: adSlotId is mandatory and cannot be numeric. Call to OpenBid will not be sent.
*/
function _getMessage(msg, dataObj) {
  msg = BIDDER_CODE + ": "+ msg;
  for (var key in dataObj) {
    msg = msg.replace(new RegExp('{%' + key + '}', 'g'), dataObj[key]);
  }
  return msg;
}

function _getDomainFromURL(url) {
  let anchor = document.createElement('a');
  anchor.href = url;
  return anchor.hostname;
}

function _parseSlotParam(paramName, paramValue) {
  if (!utils.isStr(paramValue)) {
    paramValue && utils.logWarn(_getMessage(constants.ERROR_MSG.IGNORE_PARAM,
      {
        'param_name': paramName,
        'data_type': (typeof paramValue),
        'value': paramValue
      }));
    return UNDEFINED;
  }

  switch (paramName) {
    case constants.REQUEST_KEYS.PMZONEID:
      return paramValue.split(',').slice(0, 50).map(id => id.trim()).join();
    case constants.REQUEST_KEYS.KADFLOOR:
      return parseFloat(paramValue) || UNDEFINED;
    case constants.REQUEST_KEYS.LAT:
      return parseFloat(paramValue) || UNDEFINED;
    case constants.REQUEST_KEYS.LON:
      return parseFloat(paramValue) || UNDEFINED;
    case constants.REQUEST_KEYS.YOB:
      return parseInt(paramValue) || UNDEFINED;
    case constants.REQUEST_KEYS.PROFILEID:
      return parseInt(paramValue) || UNDEFINED;
    case constants.REQUEST_KEYS.VERSIONID:
      return parseInt(paramValue) || UNDEFINED;
    case constants.REQUEST_KEYS.DCTR:
      return paramValue || UNDEFINED;
    default:
      return paramValue;
  }
}

function _cleanSlot(slotName) {
  if (utils.isStr(slotName)) {
    return slotName.replace(/^\s+/g, '').replace(/\s+$/g, '');
  }
  return '';
}

function _parseAdSlot(bid) {
  bid.params.adUnit = '';
  bid.params.adUnitIndex = '0';
  bid.params.width = 0;
  bid.params.height = 0;

  bid.params.adSlot = _cleanSlot(bid.params.adSlot);

  var slot = bid.params.adSlot;
  var splits = slot.split(':');

  slot = splits[0];
  if (splits.length == 2) {
    bid.params.adUnitIndex = splits[1];
  }
  splits = slot.split('@');
  if (splits.length != 2) {
    utils.logWarn(_getMessage(constants.ERROR_MSG.ADSLOT_FORMAT_ERROR));
    return;
  }
  bid.params.adUnit = splits[0];
  splits = splits[1].split('x');
  if (splits.length != 2) {
    utils.logWarn(_getMessage(constants.ERROR_MSG.ADSLOT_FORMAT_ERROR));
    return;
  }
  bid.params.width = parseInt(splits[0]);
  bid.params.height = parseInt(splits[1]);
}

function _initConf() {
  var conf = {};
  conf.pageURL = utils.getTopWindowUrl().trim();
  conf.refURL = utils.getTopWindowReferrer().trim();
  return conf;
}

function _handleCustomParams(params, conf) {
  if (!conf.kadpageurl) {
    conf.kadpageurl = conf.pageURL;
  }

  var key, value, entry;
  for (key in CUSTOM_PARAMS) {
    if (CUSTOM_PARAMS.hasOwnProperty(key)) {
      value = params[key];
      if (value) {
        entry = CUSTOM_PARAMS[key];

        if (typeof entry === 'object') {
          // will be used in future when we want to process a custom param before using
          // 'keyname': {f: function() {}}
          value = entry.f(value, conf);
        }

        if (utils.isStr(value)) {
          conf[key] = value;
        } else {
          utils.logWarn(_getMessage(constants.ERROR_MSG.IGNORE_PARAM,
            {
              'param_name': key,
              'data_type': (typeof value),
              'value': value
            }));
        }
      }
    }
  }
  return conf;
}

function _createOrtbTemplate(conf) {
  return {
    id: '' + new Date().getTime(),
    at: AUCTION_TYPE,
    cur: [CURRENCY],
    imp: [],
    site: {
      page: conf.pageURL,
      ref: conf.refURL,
      publisher: {}
    },
    device: {
      ua: navigator.userAgent,
      js: 1,
      dnt: (navigator.doNotTrack == 'yes' || navigator.doNotTrack == '1' || navigator.msDoNotTrack == '1') ? 1 : 0,
      h: screen.height,
      w: screen.width,
      language: navigator.language
    },
    user: {},
    ext: {}
  };
}

function _createImpressionObject(bid, conf) {
  return {
    id: bid.bidId,
    tagid: bid.params.adUnit,
    bidfloor: _parseSlotParam(constants.REQUEST_KEYS.KADFLOOR, bid.params.kadfloor),
    secure: window.location.protocol === 'https:' ? 1 : 0,
    banner: {
      pos: 0,
      w: bid.params.width,
      h: bid.params.height,
      topframe: utils.inIframe() ? 0 : 1,
    },
    ext: {
      pmZoneId: _parseSlotParam(constants.REQUEST_KEYS.PMZONEID, bid.params.pmzoneid)
    }
  };
}

export const spec = {
  code: BIDDER_CODE,

  /**
  * Determines whether or not the given bid request is valid. Valid bid request must have placementId and hbid
  *
  * @param {BidRequest} bid The bid params to validate.
  * @return boolean True if this is a valid bid, and false otherwise.
  */
  isBidRequestValid: bid => {
    if (bid && bid.params) {
      if (!utils.isStr(bid.params.publisherId)) {
        utils.logWarn(_getMessage(constants.ERROR_MSG.MANDATORY_PARAM,
          {
            'param_name': constants.REQUEST_KEYS.PUBLISHERID,
            'data_type': constants.DATA_TYPE.NUMERIC
          }));
        return false;
      }
      if (!utils.isStr(bid.params.adSlot)) {
        utils.logWarn(_getMessage(constants.ERROR_MSG.MANDATORY_PARAM,
          {
            'param_name': constants.REQUEST_KEYS.ADSLOTID,
            'data_type': constants.DATA_TYPE.NUMERIC,
          }));
        return false;
      }
      return true;
    }
    return false;
  },

  /**
  * Make a server request from the list of BidRequests.
  *
  * @param {validBidRequests[]} - an array of bids
  * @return ServerRequest Info describing the request to the server.
  */
  buildRequests: validBidRequests => {
    var conf = _initConf();
    var payload = _createOrtbTemplate(conf);
    validBidRequests.forEach(bid => {
      _parseAdSlot(bid);
      if (!(bid.params.adSlot && bid.params.adUnit && bid.params.adUnitIndex && bid.params.width && bid.params.height)) {
        utils.logWarn(_getMessage(constants.ERROR_MSG.SKIP_NONSTD_ADSLOT, {'adSlot': bid.params.adSlot, 'bid': JSON.stringify(bid)}));
        return;
      }
      conf.pubId = conf.pubId || bid.params.publisherId;
      publisherId = conf.pubId;
      conf = _handleCustomParams(bid.params, conf);
      conf.transactionId = bid.transactionId;
      payload.imp.push(_createImpressionObject(bid, conf));
    });

    if (payload.imp.length == 0) {
      return;
    }

    payload.ext.wrapper = {
      profile: _parseSlotParam(constants.REQUEST_KEYS.PROFILEID, conf.profId) || UNDEFINED,
      version: _parseSlotParam(constants.REQUEST_KEYS.VERSIONID, conf.verId) || UNDEFINED,
      wiid: conf.wiid || UNDEFINED,
      wv: constants.REPO_AND_VERSION,
      //Commenting this since, transactionId should be part of src as per ortb 2.5 standard. for now, transactionID will not be passed.
      //transactionId: conf.transactionId,
      wp: 'pbjs'
    };
    if(conf.gender || conf.lat || conf.lon || conf.yob) {
      payload.user = {
        gender: (conf.gender ? conf.gender.trim() : UNDEFINED),
        geo: {
          lat: _parseSlotParam(constants.REQUEST_KEYS.LAT, conf.lat),
          lon: _parseSlotParam(constants.REQUEST_KEYS.LON, conf.lon)
        },
        yob: _parseSlotParam(constants.REQUEST_KEYS.YOB, conf.yob)
      };
    }
    payload.device.geo = payload.user.geo;
    payload.site = {
      publisher: {
        id: conf.pubId.trim()
      },
      page: conf.kadpageurl.trim() || payload.site.page.trim(),
      domain: _getDomainFromURL(payload.site.page)
    }
    if (conf.dctr !== UNDEFINED && conf.dctr.trim().length > 0) {
      payload.site.ext = {
        key_val: conf.dctr.trim()
      };
    }
    return {
      method: 'POST',
      url: ENDPOINT,
      data: JSON.stringify(payload)
    };
  },

  /**
  * Unpack the response from the server into a list of bids.
  *
  * @param {*} response A successful response from the server.
  * @return {Bid[]} An array of bids which were nested inside the server.
  */
  interpretResponse: (response, request) => {
    const bidResponses = [];
    try {
      if (response.body && response.body.seatbid && response.body.seatbid[0] && response.body.seatbid[0].bid) {
        response.body.seatbid[0].bid.forEach(bid => {
          let newBid = {
            requestId: bid.impid,
            cpm: (parseFloat(bid.price) || 0).toFixed(2),
            width: bid.w,
            height: bid.h,
            creativeId: bid.crid || bid.id,
            dealId: bid.dealid,
            currency: CURRENCY,
            netRevenue: NET_REVENUE,
            ttl: 300,
            referrer: utils.getTopWindowUrl(),
            ad: bid.adm
          };
          bidResponses.push(newBid);
        });
      }
    } catch (error) {
      utils.logError(error);
    }
    return bidResponses;
  },

  /**
  * Register User Sync.
  */
  getUserSyncs: syncOptions => {
    if (syncOptions.iframeEnabled) {
      return [{
        type: 'iframe',
        url: USYNCURL + publisherId
      }];
    } else {
      utils.logWarn(_getMessage(constants.ERROR_MSG.ENABLE_IFRAME_SYNC));
      return [];
    }
  }
};

registerBidder(spec);
