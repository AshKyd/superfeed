"use strict";
var SprFeed = function(opts){
	this.opts = $.extend(this.opts,opts);

	this.db = new SprDb({
		name : 'SprFeed'+opts.url,
		schema : {
			feed : opts.defaults
		}
	});
	this.loadFromCache();
	this.articleCurrent=0;
}

SprFeed.prototype = {
	opts : {
		useProxy : true,
		proxyUrl : 'http://assets.kyd.com.au/jsonproxy/?uri={url}'
	},
	getRemoteUrl : function(url,callback){
		var ajaxOpts = {};
		if(this.opts.useProxy){
			ajaxOpts.url = this.opts.proxyUrl.replace('{url}',url);
			ajaxOpts.dataType = 'jsonp';
		} else {
			ajaxOpts.url = url;
		}

		ajaxOpts.success = function(data){
			callback(data);
		}

		ajaxOpts.error = function(){
			callback(false);
		}

		$.ajax(ajaxOpts);
	},
	loadFromCache : function(){
		var _this = this;

		if(_this.opts.cache !== false && _this.db.data.feed && _this.opts.onLoad){
			_this.feed = _this.db.data.feed;
			_this.opts.onLoad(_this);
		}
	},
	/**
	 * Merge two feeds. f1 is the newer feed, t2 is the older
	 * feed we want to merge in.
	 */
	_mergeEntries : function(f1,f2){
		var f1StartLength = f1.length;
		for(var j=0; j<f2.length; j++){
			var append = true;
			for(var i=0; i<f1StartLength; i++){
				if(f1[i].id == f2[j].id){
					// Extend the new version over the old version so we
					// get any changes, but keep our toggled flags.
					['read','fav'].forEach(function(prop){
						f1[i][prop] = f2[i][prop];
					});
					append = false;
					break;
				}
			}
			if(append){
				f1.push(f2[j]);
			}
		}
		return f1;
	},
	load : function(cache){
		var _this = this;

		var startTime = Date.now();
		this.getRemoteUrl(this.opts.url,function(data){
			var newFeed = new JFeed(data);

			for(var i=0;i<newFeed.entries.length;i++){
				newFeed.entries[i].description = sanitiseHTMLFragmment(newFeed.entries[i].description);
			}

			if(_this.feed && _this.feed.entries){
				newFeed.entries = _this._mergeEntries(newFeed.entries,_this.feed.entries);
			}

			newFeed.updatetime = Date.now();
			newFeed.updatelength = Date.now() - startTime;

			// Apply the feed and save it.
			_this.feed = newFeed;
			_this.save();

			_this.opts.onLoad && _this.opts.onLoad(_this);
		})
	},
	save : function(){
		this.db.data.feed = this.feed;
		this.db.save();
	},
	getOverview : function(){
		return {
			title : this.feed.title,
			link : this.feed.link,
			feedurl : this.opts.url,
			unread : this.getUnreadCount()
		}
	},
	getUnreadCount : function(){
		var count = 0;
		if(!this.feed.entries){
			return count;
		}

		for(var i=0;i<this.feed.entries.length;i++){
			if(!this.feed.entries[i].read){
				count++;
			}
		}
		return count;
	},
	_getEntryByID : function(id){
		for(var i=0; i<this.feed.entries.length; i++){
			if(this.feed.entries[i].id == id){
				return this.feed.entries[i];
			}
		}
		return false;
	},
	toggleFlag : function(id,flag){
		var entry = this._getEntryByID(id);
		entry[flag] = !entry[flag];
		this.save();
	},
	/**
	 * Mark a feed as read
	 * @param  {string} id The entry ID (usually a permalink)
	 */
	markRead : function(id){
		var entry = this._getEntryByID(id);
		if(!entry.read){
			entry.read = true;
			this.save();
		}
	}
};

var SprDb = function(opts){
	this.opts = opts;
	this.open();
}
SprDb.prototype = {
	open : function(){
		var data = localStorage[this.opts.name];
		try{
			this.data = JSON.parse(data);
		}catch(e){
			this.data = $.extend({},this.opts.schema);
		}
	},
	save : function(){
		localStorage[this.opts.name] = JSON.stringify(this.data);
		this.opts.onPostSave && this.opts.onPostSave(this);
	}

}

var SprFeeds = function(){
	this.db = new SprDb({
		name : 'SprFeeds',
		schema : {
			feeds : []
		},
		onPostSave : function(db){
			$('.sidebar').empty().append(JST["templates/sidebar.hbs"](db.data));
		}
	});
	this.db.opts.onPostSave(this.db);
}

SprFeeds.prototype = {
	_getFeedByUrl : function(url){
		for(var i=0; i < this.db.data.feeds.length; i++){
			if(this.db.data.feeds[i].feedurl == url){
				return i;
			}
		}
		return false;
	},
	createFeed : function(opts,callback){
		var _this = this;

		// If a configuration option hasn't been passed, assume
		// the string is the url and create one.
		if(typeof opts == 'string'){
			opts = {
				url : opts,
				save : true,
				defaults : false,
				loadNow : true
			}
		}

		var newFeed = new SprFeed({
			url : opts.url,
			defaults : opts.defaults,
			onLoad : function(newFeed){
				_this.db.data.feeds.push(newFeed.getOverview());
				if(opts.save){
					_this.db.save();
				}
				if(callback){
					callback(newFeed);
				}
			}
		});

		if(opts.loadNow){
			newFeed.load();
		}
	},
	updateFeeds : function(callback){
		var _this = this;
		var i = 0;
		var update = function(){
			var thisFeed = new SprFeed({
				url : _this.db.data.feeds[i].feedurl,
				cache : false,
				onLoad : function(feed){
					i++;
					if(i<_this.db.data.feeds.length){
						update();
					} else if(callback) {
						callback();
					}
				}
			});
			thisFeed.load();
		}
		update();
	},
	loadFeed : function(url){
		var _this = this;
		var feed = _this._getFeedByUrl(url);
		if(feed === false) return;

		var $feed = $('.feed.content')
			.scrollTop(0);

		var thisRef = _this.db.data.feeds[feed];
		var thisFeed = new SprFeed({
			url : thisRef.feedurl,
			onLoad : function(feed){
				$feed
					.empty()
					.append(JST["templates/feed.hbs"](feed));
				thisRef.updatetime = feed.feed.updatetime;
				thisRef.updatelength = feed.feed.updatelength;
				_this.db.save();
			}
		});
		thisFeed.load();
		this.feed = thisFeed;
	},
	deleteFeed : function(url){
		var feed = this._getFeedByUrl(url);
		if(!feed === false) return;
		this.db.data.feeds.splice(feed,1);
		this.db.save();
	},
	loadOpml : function(opml){
		var _this = this;
		if(typeof opml == 'string'){
			opml = $.parseXML(opml);
		}

		$('outline',opml).each(function(){
			if($(this).attr('xmlUrl')){
				_this.createFeed({
					url : $(this).attr('xmlUrl'),
					defaults : {
						title : $(this).attr('title')
					}
				});
			}

		});
		_this.db.save();
		//_this.updateFeeds();
	}
}

window.onload = function(){

	/**
	 * How fast do animations comlpete. (Milliseconds.)
	 * @type {Number}
	 */
	var animateSpeed = 100;

	/**
	 * The amount of scroll buffer to apply when jumping
	 * to feeds etc. This could probably be acheived with
	 * CSS padding.
	 * @type {Number}
	 */
	var scrollBuffer = 15;

	/**
	 * The main feed data source and magic happener.
	 * @type {SprFeeds}
	 */
	var feeds = new SprFeeds();

	window.onresize();

	$('.showmodal').click(function(){
		var target = $(this).data('modal');
		$(target).modal('show');
		return true;
	});

	$('#addfeed .primary').click(function(){
		var url = $(this).closest('.ui.modal').find('input[type="text"]').val();
		var feed = feeds.createFeed(url,function(){
			feeds.loadFeed(url);
		});
		
	});

	$(document).on('click','.superfeeds.action',function(){
		var action = $(this).data('action');
		var p1 = $(this).data('p1');
		feeds[action](p1);
		return false;
	});

	$(document).on('click','.superfeed.action',function(){
		var action = $(this).data('action');
		var id = $(this).closest('.entry').data('id');
		var p2 = $(this).data('p2');
		feeds.feed[action](id,p2);
		if($(this).hasClass('toggle')){
			$(this).toggleClass('active');
		}
		return false;
	});

	// Read OPML
	$('#opml').change(function(e){
		var file = e.originalEvent.target.files[0];
		var reader = new FileReader();
		reader.onload = function(e){
			var opml = e.target.result;
			$('#importFeeds').modal('hide');

			// Leave a little delay to let the animation be buttery.
			window.setTimeout(function(){
				feeds.loadOpml(opml);
			},500);
		}
		reader.readAsText(file);

		return false;
	});


	/* Mark as read functionality */
	var getTopWithOffsets = function($newTarget){
		return $newTarget.offset().top +
			$('.feed').scrollTop() -
			$('.feed').offset().top;
	}

	Mousetrap.bind(['j','k'],function(e,key){

		var articleCurrent = feeds.feed.articleCurrent;

		feeds.feed.markRead($('.entries .entry').eq(articleCurrent).data('id'));

		if(key == 'j'){
			articleCurrent++;
		} else {
			articleCurrent--;
		}

		if(articleCurrent < 0) {
			articleCurrent = 0;
		}

		if(articleCurrent >= $('.entries .entry').length) {
			articleCurrent--;
		}

		$('.feed').animate({
			scrollTop : getTopWithOffsets($('.entries .entry').eq(articleCurrent)) - scrollBuffer
		},animateSpeed);

		feeds.feed.articleCurrent = articleCurrent;

	});

	$('.feed').scroll(function(){
		var scrollTop = $(this).scrollTop();

		// This could get slow for large feeds. I'm not sure
		// if I want to equate list index with feed index yet.
		$('.entry',this).each(function(i){
			if(scrollTop >= getTopWithOffsets($(this)) - scrollBuffer*2){
				feeds.feed.markRead($(this).data('id'));
				feeds.feed.articleCurrent = i;
				$('.entries .entry .read').eq(i).addClass('active');
			}
		})
	})
}

window.onresize = function(){
	$('body').height(window.innerHeight+'px');
}