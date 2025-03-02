var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/* Tabulator v4.0.3 (c) Oliver Folkerd */

var Edit = function Edit(table) {
	this.table = table; //hold Tabulator object
	this.currentCell = false; //hold currently editing cell
	this.mouseClick = false; //hold mousedown state to prevent click binding being overriden by editor opening
	this.recursionBlock = false; //prevent focus recursion
	this.invalidEdit = false;
};

//initialize column editor
Edit.prototype.initializeColumn = function (column) {
	var self = this,
	    config = {
		editor: false,
		blocked: false,
		check: column.definition.editable,
		params: column.definition.editorParams || {}
	};

	//set column editor
	switch (_typeof(column.definition.editor)) {
		case "string":
			if (self.editors[column.definition.editor]) {
				config.editor = self.editors[column.definition.editor];
			} else {
				console.warn("Editor Error - No such editor found: ", column.definition.editor);
			}
			break;

		case "function":
			config.editor = column.definition.editor;
			break;

		case "boolean":

			if (column.definition.editor === true) {

				if (typeof column.definition.formatter !== "function") {
					if (self.editors[column.definition.formatter]) {
						config.editor = self.editors[column.definition.formatter];
					} else {
						config.editor = self.editors["input"];
					}
				} else {
					console.warn("Editor Error - Cannot auto lookup editor for a custom formatter: ", column.definition.formatter);
				}
			}
			break;
	}

	if (config.editor) {
		column.modules.edit = config;
	}
};

Edit.prototype.getCurrentCell = function () {
	return this.currentCell ? this.currentCell.getComponent() : false;
};

Edit.prototype.clearEditor = function () {
	var cell = this.currentCell,
	    cellEl;

	this.invalidEdit = false;

	if (cell) {
		this.currentCell = false;

		cellEl = cell.getElement();
		cellEl.classList.remove("tabulator-validation-fail");
		cellEl.classList.remove("tabulator-editing");
		while (cellEl.firstChild) {
			cellEl.removeChild(cellEl.firstChild);
		}cell.row.getElement().classList.remove("tabulator-row-editing");
	}
};

Edit.prototype.cancelEdit = function () {

	if (this.currentCell) {
		var cell = this.currentCell;
		var component = this.currentCell.getComponent();

		this.clearEditor();
		cell.setValueActual(cell.getValue());

		if (cell.column.cellEvents.cellEditCancelled) {
			cell.column.cellEvents.cellEditCancelled.call(this.table, component);
		}

		this.table.options.cellEditCancelled.call(this.table, component);
	}
};

//return a formatted value for a cell
Edit.prototype.bindEditor = function (cell) {
	var self = this,
	    element = cell.getElement();

	element.setAttribute("tabindex", 0);

	element.addEventListener("click", function (e) {
		if (!element.classList.contains("tabulator-editing")) {
			element.focus();
		}
	});

	element.addEventListener("mousedown", function (e) {
		self.mouseClick = true;
	});

	element.addEventListener("focus", function (e) {
		if (!self.recursionBlock) {
			self.edit(cell, e, false);
		}
	});
};

Edit.prototype.focusCellNoEvent = function (cell) {
	this.recursionBlock = true;
	cell.getElement().focus();
	this.recursionBlock = false;
};

Edit.prototype.editCell = function (cell, forceEdit) {
	this.focusCellNoEvent(cell);
	this.edit(cell, false, forceEdit);
};

Edit.prototype.edit = function (cell, e, forceEdit) {
	var self = this,
	    allowEdit = true,
	    rendered = function rendered() {},
	    element = cell.getElement(),
	    cellEditor,
	    component,
	    params;

	//prevent editing if another cell is refusing to leave focus (eg. validation fail)
	if (this.currentCell) {
		if (!this.invalidEdit) {
			this.cancelEdit();
		}
		return;
	}

	//handle successfull value change
	function success(value) {

		if (self.currentCell === cell) {
			var valid = true;

			if (cell.column.modules.validate && self.table.modExists("validate")) {
				valid = self.table.modules.validate.validate(cell.column.modules.validate, cell.getComponent(), value);
			}

			if (valid === true) {
				self.clearEditor();
				cell.setValue(value, true);
			} else {
				self.invalidEdit = true;
				element.classList.add("tabulator-validation-fail");
				self.focusCellNoEvent(cell);
				rendered();
				self.table.options.validationFailed.call(self.table, cell.getComponent(), value, valid);
			}
		} else {
			// console.warn("Edit Success Error - cannot call success on a cell that is no longer being edited");
		}
	}

	//handle aborted edit
	function cancel() {
		if (self.currentCell === cell) {
			self.cancelEdit();
		} else {
			// console.warn("Edit Success Error - cannot call cancel on a cell that is no longer being edited");
		}
	}

	function onRendered(callback) {
		rendered = callback;
	}

	if (!cell.column.modules.edit.blocked) {
		if (e) {
			e.stopPropagation();
		}

		switch (_typeof(cell.column.modules.edit.check)) {
			case "function":
				allowEdit = cell.column.modules.edit.check(cell.getComponent());
				break;

			case "boolean":
				allowEdit = cell.column.modules.edit.check;
				break;
		}

		if (allowEdit || forceEdit) {

			self.cancelEdit();

			self.currentCell = cell;

			component = cell.getComponent();

			if (this.mouseClick) {
				this.mouseClick = false;

				if (cell.column.cellEvents.cellClick) {
					cell.column.cellEvents.cellClick.call(this.table, component);
				}
			}

			if (cell.column.cellEvents.cellEditing) {
				cell.column.cellEvents.cellEditing.call(this.table, component);
			}

			self.table.options.cellEditing.call(this.table, component);

			params = typeof cell.column.modules.edit.params === "function" ? cell.column.modules.edit.params(component) : cell.column.modules.edit.params;

			cellEditor = cell.column.modules.edit.editor.call(self, component, onRendered, success, cancel, params);

			//if editor returned, add to DOM, if false, abort edit
			if (cellEditor !== false) {
				element.classList.add("tabulator-editing");
				cell.row.getElement().classList.add("tabulator-row-editing");
				while (element.firstChild) {
					element.removeChild(element.firstChild);
				}element.appendChild(cellEditor);

				//trigger onRendered Callback
				rendered();

				//prevent editing from triggering rowClick event
				var children = element.children;

				for (var i = 0; i < children.length; i++) {
					children[i].addEventListener("click", function (e) {
						e.stopPropagation();
					});
				}
			} else {
				element.blur();
				return false;
			}

			return true;
		} else {
			this.mouseClick = false;
			element.blur();
			return false;
		}
	} else {
		this.mouseClick = false;
		element.blur();
		return false;
	}
};

//default data editors
Edit.prototype.editors = {

	//input element
	input: function input(cell, onRendered, success, cancel, editorParams) {

		//create and style input
		var cellValue = cell.getValue(),
		    input = document.createElement("input");

		input.setAttribute("type", "text");

		input.style.padding = "4px";
		input.style.width = "100%";
		input.style.boxSizing = "border-box";

		input.value = typeof cellValue !== "undefined" ? cellValue : "";

		onRendered(function () {
			input.focus();
			input.style.height = "100%";
		});

		function onChange(e) {
			if (input.value != cellValue) {
				success(input.value);
			} else {
				cancel();
			}
		}

		//submit new value on blur or change
		input.addEventListener("change", onChange);
		input.addEventListener("blur", onChange);

		//submit new value on enter
		input.addEventListener("keydown", function (e) {
			switch (e.keyCode) {
				case 13:
					success(input.value);
					break;

				case 27:
					cancel();
					break;
			}
		});

		return input;
	},

	//resizable text area element
	textarea: function textarea(cell, onRendered, success, cancel, editorParams) {
		var self = this,
		    cellValue = cell.getValue(),
		    value = String(typeof cellValue == "null" || typeof cellValue == "undefined" ? "" : cellValue),
		    count = (value.match(/(?:\r\n|\r|\n)/g) || []).length + 1,
		    input = document.createElement("textarea"),
		    scrollHeight = 0;

		//create and style input
		input.style.display = "block";
		input.style.padding = "2px";
		input.style.height = "100%";
		input.style.width = "100%";
		input.style.boxSizing = "border-box";
		input.style.whiteSpace = "pre-wrap";
		input.style.resize = "none";

		input.value = value;

		onRendered(function () {
			input.focus();
			input.style.height = "100%";
		});

		function onChange(e) {
			if (input.value != cellValue) {
				success(input.value);
				setTimeout(function () {
					cell.getRow().normalizeHeight();
				}, 300);
			} else {
				cancel();
			}
		}

		//submit new value on blur or change
		input.addEventListener("change", onChange);
		input.addEventListener("blur", onChange);

		input.addEventListener("keyup", function () {

			input.style.height = "";

			var heightNow = input.scrollHeight;

			input.style.height = heightNow + "px";

			if (heightNow != scrollHeight) {
				scrollHeight = heightNow;
				cell.getRow().normalizeHeight();
			}
		});

		input.addEventListener("keydown", function (e) {
			if (e.keyCode == 27) {
				cancel();
			}
		});

		return input;
	},

	//input element with type of number
	number: function number(cell, onRendered, success, cancel, editorParams) {

		var cellValue = cell.getValue(),
		    input = document.createElement("input");

		input.setAttribute("type", "number");

		if (typeof editorParams.max != "undefined") {
			input.setAttribute("max", editorParams.max);
		}

		if (typeof editorParams.min != "undefined") {
			input.setAttribute("min", editorParams.min);
		}

		if (typeof editorParams.step != "undefined") {
			input.setAttribute("step", editorParams.step);
		}

		//create and style input
		input.style.padding = "4px";
		input.style.width = "100%";
		input.style.boxSizing = "border-box";

		input.value = cellValue;

		onRendered(function () {
			input.focus();
			input.style.height = "100%";
		});

		function onChange() {
			var value = input.value;

			if (!isNaN(value) && value !== "") {
				value = Number(value);
			}

			if (value != cellValue) {
				success(value);
			} else {
				cancel();
			}
		}

		//submit new value on blur
		input.addEventListener("blur", function (e) {
			onChange();
		});

		//submit new value on enter
		input.addEventListener("keydown", function (e) {
			switch (e.keyCode) {
				case 13:
				case 9:
					onChange();
					break;

				case 27:
					cancel();
					break;
			}
		});

		return input;
	},

	//input element with type of number
	range: function range(cell, onRendered, success, cancel, editorParams) {

		var cellValue = cell.getValue(),
		    input = document.createElement("input");

		input.setAttribute("type", "range");

		if (typeof editorParams.max != "undefined") {
			input.setAttribute("max", editorParams.max);
		}

		if (typeof editorParams.min != "undefined") {
			input.setAttribute("min", editorParams.min);
		}

		if (typeof editorParams.step != "undefined") {
			input.setAttribute("step", editorParams.step);
		}

		//create and style input
		input.style.padding = "4px";
		input.style.width = "100%";
		input.style.boxSizing = "border-box";

		input.value = cellValue;

		onRendered(function () {
			input.focus();
			input.style.height = "100%";
		});

		function onChange() {
			var value = input.value;

			if (!isNaN(value) && value !== "") {
				value = Number(value);
			}

			if (value != cellValue) {
				success(value);
			} else {
				cancel();
			}
		}

		//submit new value on blur
		input.addEventListener("blur", function (e) {
			onChange();
		});

		//submit new value on enter
		input.addEventListener("keydown", function (e) {
			switch (e.keyCode) {
				case 13:
				case 9:
					onChange();
					break;

				case 27:
					cancel();
					break;
			}
		});

		return input;
	},

	//select
	select: function select(cell, onRendered, success, cancel, editorParams) {
		//create and style select
		var select = document.createElement("select");
		var isArray = Array.isArray(editorParams);

		if (typeof editorParams == "function") {
			editorParams = editorParams(cell);
			isArray = Array.isArray(editorParams);
		}

		function optionAppend(element, label, value, disabled) {

			var option = document.createElement("option");

			option.value = value;
			option.text = label;

			if (disabled) {
				option.disabled = true;
			}

			element.appendChild(option);
		}

		function processOption(element, option) {
			var groupEl;

			if (option.options) {
				groupEl = document.createElement("optgroup");

				groupEl.setAttribute("lavel", option.label);

				option.options.forEach(function (item) {
					processOption(groupEl, item);
				});

				element.appendChild(groupEl);
			} else {
				optionAppend(element, typeof option.label == "undefined" ? option.value : option.label, typeof option.value == "undefined" ? option.label : option.value, option.disabled);
			}
		}

		if (!isArray && (typeof editorParams === "undefined" ? "undefined" : _typeof(editorParams)) === "object") {
			for (var key in editorParams) {
				optionAppend(select, editorParams[key], key);
			}
		} else if (isArray) {
			editorParams.forEach(function (item) {
				processOption(select, item);
			});
		}

		//create and style input
		select.style.padding = "4px";
		select.style.width = "100%";
		select.style.boxSizing = "border-box";
		select.style.fontFamily = "";

		select.value = cell.getValue();

		onRendered(function () {
			select.focus();
		});

		//submit new value on blur
		function onChange(e) {
			if (select.selectedIndex > -1) {
				success(select.options[select.selectedIndex].value);
			} else {
				cancel();
			}
		}

		select.addEventListener("change", onChange);
		select.addEventListener("blur", onChange);

		//submit new value on enter
		select.addEventListener("keydown", function (e) {
			if (e.keyCode === 13) {
				success(select.options[select.selectedIndex].value);
			}
		});
		return select;
	},

	//start rating
	star: function star(cell, onRendered, success, cancel, editorParams) {
		var self = this,
		    element = cell.getElement(),
		    value = cell.getValue(),
		    maxStars = element.getElementsByTagName("svg").length || 5,
		    size = element.getElementsByTagName("svg")[0] ? element.getElementsByTagName("svg")[0].getAttribute("width") : 14,
		    stars = [],
		    starsHolder = document.createElement("div"),
		    star = document.createElementNS('http://www.w3.org/2000/svg', "svg");

		//change star type
		function starChange(val) {
			stars.forEach(function (star, i) {
				if (i < val) {
					if (self.table.browser == "ie") {
						star.setAttribute("class", "tabulator-star-active");
					} else {
						star.classList.replace("tabulator-star-inactive", "tabulator-star-active");
					}

					star.innerHTML = '<polygon fill="#488CE9" stroke="#014AAE" stroke-width="37.6152" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" points="259.216,29.942 330.27,173.919 489.16,197.007 374.185,309.08 401.33,467.31 259.216,392.612 117.104,467.31 144.25,309.08 29.274,197.007 188.165,173.919 "/>';
				} else {
					if (self.table.browser == "ie") {
						star.setAttribute("class", "tabulator-star-inactive");
					} else {
						star.classList.replace("tabulator-star-active", "tabulator-star-inactive");
					}

					star.innerHTML = '<polygon fill="#010155" stroke="#686868" stroke-width="37.6152" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" points="259.216,29.942 330.27,173.919 489.16,197.007 374.185,309.08 401.33,467.31 259.216,392.612 117.104,467.31 144.25,309.08 29.274,197.007 188.165,173.919 "/>';
				}
			});
		}

		//build stars
		function buildStar(i) {
			var nextStar = star.cloneNode(true);

			stars.push(nextStar);

			nextStar.addEventListener("mouseover", function (e) {
				e.stopPropagation();
				starChange(i);
			});

			nextStar.addEventListener("click", function (e) {
				e.stopPropagation();
				success(i);
			});

			starsHolder.appendChild(nextStar);
		}

		//handle keyboard navigation value change
		function changeValue(val) {
			value = val;
			starChange(val);
		}

		//style cell
		element.style.whiteSpace = "nowrap";
		element.style.overflow = "hidden";
		element.style.textOverflow = "ellipsis";

		//style holding element
		starsHolder.style.verticalAlign = "middle";
		starsHolder.style.display = "inline-block";
		starsHolder.style.padding = "4px";

		//style star
		star.setAttribute("width", size);
		star.setAttribute("height", size);
		star.setAttribute("viewBox", "0 0 512 512");
		star.setAttribute("xml:space", "preserve");
		star.style.padding = "0 1px";

		//create correct number of stars
		for (var i = 1; i <= maxStars; i++) {
			buildStar(i);
		}

		//ensure value does not exceed number of stars
		value = Math.min(parseInt(value), maxStars);

		// set initial styling of stars
		starChange(value);

		starsHolder.addEventListener("mouseover", function (e) {
			starChange(0);
		});

		starsHolder.addEventListener("click", function (e) {
			success(0);
		});

		element.addEventListener("blur", function (e) {
			cancel();
		});

		//allow key based navigation
		element.addEventListener("keydown", function (e) {
			switch (e.keyCode) {
				case 39:
					//right arrow
					changeValue(value + 1);
					break;

				case 37:
					//left arrow
					changeValue(value - 1);
					break;

				case 13:
					//enter
					success(value);
					break;

				case 27:
					//escape
					cancel();
					break;
			}
		});

		return starsHolder;
	},

	//draggable progress bar
	progress: function progress(cell, onRendered, success, cancel, editorParams) {
		var element = cell.getElement(),
		    max = typeof editorParams.max === "undefined" ? element.getElementsByTagName("div")[0].getAttribute("max") || 100 : editorParams.max,
		    min = typeof editorParams.min === "undefined" ? element.getElementsByTagName("div")[0].getAttribute("min") || 0 : editorParams.min,
		    percent = (max - min) / 100,
		    value = cell.getValue() || 0,
		    handle = document.createElement("div"),
		    bar = document.createElement("div"),
		    mouseDrag,
		    mouseDragWidth;

		//set new value
		function updateValue() {
			var calcVal = percent * Math.round(bar.offsetWidth / (element.clientWidth / 100)) + min;
			success(calcVal);
			element.setAttribute("aria-valuenow", calcVal);
			element.setAttribute("aria-label", value);
		}

		//style handle
		handle.style.position = "absolute";
		handle.style.right = "0";
		handle.style.top = "0";
		handle.style.bottom = "0";
		handle.style.width = "5px";
		handle.classList.add("tabulator-progress-handle");

		//style bar
		bar.style.display = "inline-block";
		bar.style.position = "absolute";
		bar.style.top = "8px";
		bar.style.bottom = "8px";
		bar.style.left = "4px";
		bar.style.marginRight = "4px";
		bar.style.backgroundColor = "#488CE9";
		bar.style.maxWidth = "100%";
		bar.style.minWidth = "0%";

		//style cell
		element.style.padding = "0 4px";

		//make sure value is in range
		value = Math.min(parseFloat(value), max);
		value = Math.max(parseFloat(value), min);

		//workout percentage
		value = 100 - Math.round((value - min) / percent);
		bar.style.right = value + "%";

		element.setAttribute("aria-valuemin", min);
		element.setAttribute("aria-valuemax", max);

		bar.appendChild(handle);

		handle.addEventListener("mousedown", function (e) {
			mouseDrag = e.screenX;
			mouseDragWidth = bar.offsetWidth;
		});

		handle.addEventListener("mouseover", function () {
			handle.style.cursor = "ew-resize";
		});

		element.addEventListener("mousemove", function (e) {
			if (mouseDrag) {
				bar.style.width = mouseDragWidth + e.screenX - mouseDrag + "px";
			}
		});

		element.addEventListener("mouseup", function (e) {
			if (mouseDrag) {
				e.stopPropagation();
				e.stopImmediatePropagation();

				mouseDrag = false;
				mouseDragWidth = false;

				updateValue();
			}
		});

		//allow key based navigation
		element.addEventListener("keydown", function (e) {
			switch (e.keyCode) {
				case 39:
					//right arrow
					bar.style.width = bar.clientWidth + element.clientWidth / 100 + "px";
					break;

				case 37:
					//left arrow
					bar.style.width = bar.clientWidth - element.clientWidth / 100 + "px";
					break;

				case 13:
					//enter
					updateValue();
					break;

				case 27:
					//escape
					cancel();
					break;

			}
		});

		element.addEventListener("blur", function () {
			cancel();
		});

		return bar;
	},

	//checkbox
	tickCross: function tickCross(cell, onRendered, success, cancel, editorParams) {
		var value = cell.getValue(),
		    input = document.createElement("input");

		input.setAttribute("type", "checkbox");
		input.style.marginTop = "5px";
		input.style.boxSizing = "border-box";

		input.value = value;

		if (this.table.browser != "firefox") {
			//prevent blur issue on mac firefox
			onRendered(function () {
				input.focus();
			});
		}

		input.checked = value === true || value === "true" || value === "True" || value === 1;

		//submit new value on blur
		input.addEventListener("change", function (e) {
			success(input.checked);
		});

		input.addEventListener("blur", function (e) {
			success(input.checked);
		});

		//submit new value on enter
		input.addEventListener("keydown", function (e) {
			if (e.keyCode == 13) {
				success(input.checked);
			}
			if (e.keyCode == 27) {
				cancel();
			}
		});

		return input;
	},

	//checkbox
	tick: function tick(cell, onRendered, success, cancel, editorParams) {
		var value = cell.getValue(),
		    input = document.createElement("input");

		input.setAttribute("type", "checkbox");
		input.style.marginTop = "5px";
		input.style.boxSizing = "border-box";

		input.value = value;

		if (this.table.browser != "firefox") {
			//prevent blur issue on mac firefox
			onRendered(function () {
				input.focus();
			});
		}

		input.checked = value === true || value === "true" || value === "True" || value === 1;

		//submit new value on blur
		input.addEventListener("change", function (e) {
			success(input.checked);
		});

		input.addEventListener("blur", function (e) {
			success(input.checked);
		});

		//submit new value on enter
		input.addEventListener("keydown", function (e) {
			if (e.keyCode == 13) {
				success(input.checked);
			}
			if (e.keyCode == 27) {
				cancel();
			}
		});

		return input;
	}
};

Tabulator.prototype.registerModule("edit", Edit);