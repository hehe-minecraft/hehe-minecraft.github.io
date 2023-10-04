{
	if (navigator.userAgent.includes("Chrome"))
	{
		document.documentElement.dataset.browser = "ms";
	}
	else
	{
		document.documentElement.dataset.browser = "webkit";
		for (let each_item of document.querySelectorAll("math:not([inline])"))
		{
			each_item.setAttribute("display", "block");
		};
	};
}