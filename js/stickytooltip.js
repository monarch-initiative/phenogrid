(function () {
'use strict';

/* 
* minor code based adapted from Sticky Tooltip script (v1.0)
* Created: Nov 25th, 2009. This notice must stay intact for usage 
* Author: Dynamic Drive at http://www.dynamicdrive.com/
* Visit http://www.dynamicdrive.com/ for full source code
*/

var jQuery = require('jquery'); // Have to be 'jquery', can't use 'jQuery'
var $ = jQuery;

var stickytooltip = {
	tooltipoffsets: {x:-4, y:2}, //additional x and y offset from mouse cursor for tooltips 0,-6  [10, 10]
	fadeinspeed: 1, //duration of fade effect in milliseconds
	isdocked: false,  // force sticky mode


	positiontooltip:function($, $tooltip, e){
		var x = e.left + this.tooltipoffsets.x, y = e.top + this.tooltipoffsets.y;
		$tooltip.css({left:x, top:y});
	},
	
	showbox:function($, $tooltip, e){
		$tooltip.fadeIn(this.fadeinspeed);
		//$tooltip.fadeOut(10000);		
		this.positiontooltip($, $tooltip, e);
		stickytooltip.isdocked = true;

		// this will fade out the stickytooltip if idle too long
		setTimeout(function() { 
        $('#mystickytooltip').fadeOut();}, 9000); 
	},

	// wrapper function
	show:function(e) {
		var $tooltip = $('#mystickytooltip');
		stickytooltip.isdocked = true;
		stickytooltip.showbox($, $tooltip, e);
	},

	hidebox:function($, $tooltip){
		if (!this.isdocked){
			$tooltip.stop(false, true).hide();
			stickytooltip.isdocked = false;
		}
	},

	// wrapper function
	closetooltip:function() {		
		var $tooltip = jQuery('#mystickytooltip');
		stickytooltip.isdocked = false;
		stickytooltip.hidebox($, $tooltip);
	},

	init:function(targetselector, tipid){
		jQuery(document).ready(function($){
			var $targets = jQuery(targetselector);  //    $(targetselector);
			var $tooltip = $('#'+tipid).appendTo(document.body);
			if ($targets.length == 0) {
				return;
			}

			stickytooltip.hidebox($, $tooltip);
			
			// this mouseout helps make the overall mouse out process smoother
			$targets.bind('mouseout', function(e){  
				var elem = e.relatedTarget ||  e.toElement || e.fromElement;
				if (typeof(elem) !== 'undefined' ) {
					if (elem.id != 'mystickytooltip' && elem.id != "") {					    
						stickytooltip.isdocked = false;
				 		stickytooltip.hidebox($, $tooltip);
					}
				}
			 });
		}); //end dom ready
	}
};

// CommonJS format
module.exports=stickytooltip;

}());