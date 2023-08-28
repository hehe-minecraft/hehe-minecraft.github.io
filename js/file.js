import sync from "./noasync.js"

function read_file(file)
{
	let reader = FileReader();
	reader.readAsDataURL(file)
	return sync(reader, "load");
};