function update_pre(){
	function add_lines(lines, element)
	{
		for (let each_line_index in lines)
		{
			let each_line = lines[each_line_index];
			let line_number = document.createElement("span");
			line_number.classList.add("line-number");
			line_number.innerText = Number(each_line_index) + 1;
			let line = document.createElement("span");
			line.classList.add("line");
			line.innerText += each_line;
			element.appendChild(line_number);
			element.appendChild(line);
		};
	};

	let elements = document.getElementsByTagName("pre");
	for (let each_element of elements)
	{
		let src = each_element.getAttribute("src");
		if (!src)
		{
			let original_text = each_element.innerText.trimEnd();
			let lines = new Array();
			let tabs = original_text.length - original_text.trimStart().length;
			each_element.innerText = "";
			for (let each_line of original_text.split("\n"))
			{
				lines.push(each_line.substring(tabs));
			};
			add_lines(lines, each_element);
		}
		else
		{
			let file_request = new XMLHttpRequest();
			file_request.open("GET", src, true);
			file_request.onload = function ()
			{
				if (file_request.status === 200)
				{
					let lines = file_request.responseText.split("\n");
					add_lines(lines, each_element);
				}
				else
				{
					each_element.innerText = "Unable to load file.";
				};
			};
			file_request.send();
		};
	};
};

update_pre();