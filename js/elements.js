function remove_elements(element_list)
{
	for (each_element of element_list)
	{
		each_element.remove();
	};
};

function remove_children(element, first_index = 0, last_index = undefined)
{
	remove_elements(Array.from(element.children).slice(first_index, last_index));
};