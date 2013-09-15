"use strict";
var SprFeed = function(opts){
	this.opts = $.extend(this.opts,opts);

	this.db = new SprDb({
		name : 'SprFeed'+opts.url,
		schema : {
			feed : false
		}
	});
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
	load : function(callback){
		var _this = this;
		if(_this.db.data.feed && _this.opts.onLoad){
			_this.feed = _this.db.data.feed;
			_this.opts.onLoad(_this);
		}
		this.getRemoteUrl(this.opts.url,function(data){
			_this.feed = new JFeed(data);

			for(var i=0;i<_this.feed.entries.length;i++){
				_this.feed.entries[i].description = sanitiseHTMLFragmment(_this.feed.entries[i].description);
			}
			_this.db.data.feed = _this.feed;
			_this.db.save();

			_this.opts.onLoad && _this.opts.onLoad(_this);
		})
	},
	getOverview : function(){
		return {
			title : this.feed.title,
			link : this.feed.link,
			feedurl : this.opts.url
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
	createFeed : function(url,callback){
		var _this = this;
		var newFeed = new SprFeed({
			url : url
		});
		newFeed.load(function(){
			_this.db.data.feeds.push(newFeed.getOverview());
			_this.db.save();
			callback(newFeed);
		})
	},
	loadFeed : function(url){
		var feed = this._getFeedByUrl(url);
		if(feed === false) return;
		var thisFeed = new SprFeed({
			url : this.db.data.feeds[feed].feedurl,
			onLoad : function(){
				$('.feed.content').empty().append(JST["templates/feed.hbs"](thisFeed));
			},
			onUpdate : function(){

			}
		});
		thisFeed.load();
	},
	deleteFeed : function(url){
		var feed = this._getFeedByUrl(url);
		if(!feed === false) return;
		this.db.data.feeds.splice(feed,1);
		this.db.save();
	}
}

window.onload = function(){
	window.onresize();

	var feeds = new SprFeeds();

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
}

window.onresize = function(){
	$('body').height(window.innerHeight+'px');
}