function Utils() {};

Utils.getConceptId = function (uri) {
		// replace spaces with underscores. Classes are separated with spaces so a class called "Model 1" will be two classes: Model and 1. Convert this to "Model_1" to avoid this problem.
		var retString = uri;
		try {
			retString = retString.replace(" ", "_");
			retString = retString.replace(":", "_");
			return retString;
		} catch (exception) {}
};

Utils.normalizeIC = function(datarow, maxICScore){
		var aIC = datarow.a.IC;
		var bIC = datarow.b.IC;
		var lIC = datarow.lcs.IC;
		var nic;

		var ics = new Array(3);

		// 0 - similarity
		nic = Math.sqrt((Math.pow(aIC - lIC, 2)) + (Math.pow(bIC - lIC, 2)));
		nic = (1 - (nic / + maxICScore)) * 100;
		ics[0] = nic;

		// 1 - ratio(q)
		nic = ((lIC / aIC) * 100);
		ics[1] = nic;

		// 2 - uniquenss
		nic = lIC;
		ics[2] = nic;

		// 3 - ratio(t)
		nic = ((lIC / bIC) * 100);
		ics[3] = nic;

		return ics;
};

// return a label for use in the list. This label is shortened to fit within the space in the column
Utils.getShortLabel = function(label, newlength) {
	if (label !== undefined){
		var retLabel = label;
		if (!newlength) {
			newlength = 34;  //this.state.textLength;
		}
		if (label.length > newlength) {
			retLabel = label.substring(0,newlength-3) + "...";
		}	
		return retLabel;
	}else {
		return "Unknown";
	}
};

	// encode any special chars 
Utils.encodeHtmlEntity = function(str) {
	if (str !== null) {
		return str
		.replace(/»/g, "&#187;")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
	}
	return str;
};

Utils.decodeHtmlEntity = function(str) {
	return $('<div></div>').html(str).text();
};
