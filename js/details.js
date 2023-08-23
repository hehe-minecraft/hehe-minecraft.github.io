function details_flip(flip_id) {
	let item = document.getElementById(flip_id);
	console.log(item);
	if (item)
	{
		if (item.style.display == "none" || item.style.display == "")
		{
			item.style.display = "inline";
		}
		else
		{
			item.style.display = "none";
		};
	};
};