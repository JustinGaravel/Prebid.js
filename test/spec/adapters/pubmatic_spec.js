// refer aol_spec.js | adfor_spec.js
import {expect} from 'chai';
import * as utils from 'src/utils';
import PubMaticAdapter from 'src/adapters/pubmatic';
import bidmanager from 'src/bidmanager';

let getDefaultBidRequest = () => {
  return {
    bidderCode: 'pubmatic',
    requestId: 'd3e07445-ab06-44c8-a9dd-5ef9af06d2a6',
    bidderRequestId: '7101db09af0db2',
    start: new Date().getTime(),
    bids: [{
      bidder: 'pubmatic',
      bidId: '84ab500420319d',
      bidderRequestId: '7101db09af0db2',
      requestId: 'd3e07445-ab06-44c8-a9dd-5ef9af06d2a6',
      placementCode: 'DIV_1',
      params: {
        placement: 1234567,
        network: '9599.1'
      }
    }]
  };
};

describe('PubMaticAdapter', () => {
  let adapter;
	
  function createBidderRequest({bids, params} = {}) {
    var bidderRequest = getDefaultBidRequest();
    if (bids && Array.isArray(bids)) {
      bidderRequest.bids = bids;
    }
    if (params) {
      bidderRequest.bids.forEach(bid => bid.params = params);
    }
    return bidderRequest;
  }

  beforeEach(() => adapter = new PubMaticAdapter());

  describe('callBids()', () => {
    it('exists and is a function', () => {
      expect(adapter.callBids).to.exist.and.to.be.a('function');
    });

    describe('user syncup', () => {

    	beforeEach(() => {			
        	sinon.stub(utils, "insertElement");
		});

		afterEach(() => {
        	utils.insertElement.restore();
		});

    	it('usersync is initiated', () => {        	
        	adapter.callBids(createBidderRequest({
				params: {
				  publisherId: 9999,
				  adSlot: "abcd@728x90",
				  age: "20"
				}
			}));
			utils.insertElement.calledOnce.should.be.true;
			expect(utils.insertElement.getCall(0).args[0].src).to.equal("http://ads.pubmatic.com/AdServer/js/showad.js#PIX&kdntuid=1&p=9999");
        });

    });

    describe('bid request', () => {

		beforeEach(() => {
			sinon.stub(utils, "createContentToExecuteExtScriptInFriendlyFrame", function(){return '';});
		});

		afterEach(() => {
			utils.createContentToExecuteExtScriptInFriendlyFrame.restore();
		});

		it('requires parameters to be made', () => {
          adapter.callBids({});
          utils.createContentToExecuteExtScriptInFriendlyFrame.calledOnce.should.be.false;
        });        

        it('for publisherId 9999 call is made to haso.pubmatic.com', () => {        	
          adapter.callBids(createBidderRequest({
            params: {
              publisherId: 9999,
              adSlot: "abcd@728x90",
              age: "20"
            }
          }));
          //console.log("utils.createContentToExecuteExtScriptInFriendlyFrame.called ==> ", utils.createContentToExecuteExtScriptInFriendlyFrame.called);
          //console.log(utils.createContentToExecuteExtScriptInFriendlyFrame.getCall(0).args);
          var callURL = utils.createContentToExecuteExtScriptInFriendlyFrame.getCall(0).args[0];
          expect(callURL).to.contain("haso.pubmatic.com");
        });
    });

    describe('bid response', () => {

    	beforeEach(() => {
    		sinon.stub(utils, "createContentToExecuteExtScriptInFriendlyFrame", function(){return '';});
          	sinon.stub(bidmanager, 'addBidResponse');
    	});

    	afterEach(() => {
    		utils.createContentToExecuteExtScriptInFriendlyFrame.restore();
    		bidmanager.addBidResponse.restore();
    	});

    	it('exists and is a function', () => {
	      expect($$PREBID_GLOBAL$$.handlePubmaticCallback).to.exist.and.to.be.a('function');
	    });

    	it('empty response, arguments not passed', () => {
	    	adapter.callBids(createBidderRequest({
				params: {
				  publisherId: 9999,
				  adSlot: "abcd@728x90",
				  age: "20"
				}
			}));
	    	$$PREBID_GLOBAL$$.handlePubmaticCallback();
	    	sinon.assert.called(bidmanager.addBidResponse);
	    });

	    it('empty response', () => {
	    	adapter.callBids(createBidderRequest({
				params: {
				  publisherId: 9999,
				  adSlot: "abcd@728x90",
				  age: "20"
				}
			}));
	    	$$PREBID_GLOBAL$$.handlePubmaticCallback({}, {});
	    	sinon.assert.called(bidmanager.addBidResponse);
	    });

	    it('not empty response', () => {
	    	adapter.callBids(createBidderRequest({
				params: {
				  publisherId: 9999,
				  adSlot: "abcd@728x90",
				  age: "20"
				}
			}));
	    	$$PREBID_GLOBAL$$.handlePubmaticCallback({
			    'abcd@728x90': {
			        "ecpm": 10,
			        "creative_tag": "hello",
			        "tracking_url": "http%3a%2f%2fhaso.pubmatic.com%2fads%2f9999%2fGRPBID%2f2.gif%3ftrackid%3d12345",
			        "width": 728,
			        "height": 90,
			        "deal_channel": 5
			    }}, {
				    'abcd@728x90': 'bidstatus;1;bid;10.0000;bidid;abcd@728x90:0;wdeal;PMERW36842'
				});
	    	sinon.assert.called(bidmanager.addBidResponse);
	    	expect(bidmanager.addBidResponse.firstCall.args[0]).to.equal("DIV_1");
	    	var theBid = bidmanager.addBidResponse.firstCall.args[1];
	    	expect(theBid.bidderCode).to.equal("pubmatic");
	    	expect(theBid.adSlot).to.equal("abcd@728x90");
	    	expect(theBid.cpm).to.equal(10);
	    	expect(theBid.width).to.equal(728);
	    	expect(theBid.height).to.equal(90);
	    	expect(theBid.dealId).to.equal("PMERW36842");
	    	expect(theBid.dealChannel).to.equal("PREF");
	    });

	    it('not empty response, without dealChannel', () => {
	    	adapter.callBids(createBidderRequest({
				params: {
				  publisherId: 9999,
				  adSlot: "abcd@728x90",
				  age: "20"				  
				}
			}));
	    	$$PREBID_GLOBAL$$.handlePubmaticCallback({
			    'abcd@728x90': {
			        "ecpm": 10,
			        "creative_tag": "hello",
			        "tracking_url": "http%3a%2f%2fhaso.pubmatic.com%2fads%2f9999%2fGRPBID%2f2.gif%3ftrackid%3d12345",
			        "width": 728,
			        "height": 90
			    }}, {
				    'abcd@728x90': 'bidstatus;1;bid;10.0000;bidid;abcd@728x90:0;wdeal;PMERW36842'
				});
	    	sinon.assert.called(bidmanager.addBidResponse);
	    	expect(bidmanager.addBidResponse.firstCall.args[0]).to.equal("DIV_1");
	    	var theBid = bidmanager.addBidResponse.firstCall.args[1];
	    	expect(theBid.bidderCode).to.equal("pubmatic");
	    	expect(theBid.adSlot).to.equal("abcd@728x90");
	    	expect(theBid.cpm).to.equal(10);
	    	expect(theBid.width).to.equal(728);
	    	expect(theBid.height).to.equal(90);
	    	expect(theBid.dealId).to.equal("PMERW36842");
	    	expect(theBid.dealChannel).to.equal(null);
	    });
    });
  });  

});  