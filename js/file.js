class AsyncObject
{
	constructor()
	{
		this.actions = {};
	};

	async wait_action(name)
	{
		if (this.actions[name])
		{
			await this.actions[name];
			this.actions[name] = undefined;
		};
	};
}

function read_file(file)
{
	let reader = new FileReader();
	reader.readAsDataURL(file);
	return Promise(function (resolve, reject){
		reader.onload = function (event) {
			resolve(reader.result);
		};
		reader.onerror = function (event) {
			reject(reader.error);
		};
	});
};

class DataBase extends AsyncObject
{
	constructor(namespace, version=undefined, areas=[])
	{
		super();
		this.upgradeneeded = false;
		this.actions = {
			open: undefined
		};
		this.database = undefined;
		let database = indexedDB.open(namespace, version);
		const WrapperObject = this;
		this.actions.open = new Promise(function (resolve, reject){
			database.onsuccess = function (event) {
				WrapperObject.database = database.result;
				resolve(database.result);
			};
			database.onupgradeneeded = function (event) {
				WrapperObject.upgradeneeded = true;
				WrapperObject.database = database.result;
				for (let each_area of areas)
				{
					WrapperObject.database.createObjectStore(each_area, {keyPath: "key"});
				};
				resolve(database.result);
			};
			database.onerror = function (event) {
				reject(database.error);
			};
		});
	};

	write_to_data(area, key, content)
	{
		let transaction = this.database.transaction(area, "readwrite");
		transaction.objectStore(area).put({key: key, content: content});
	};

	delete_data(area, key)
	{
		let transaction = this.database.transaction(area, "readwrite");
		transaction.objectStore(area).delete(key);
	};

	get_data(area, key)
	{
		let transaction = this.database.transaction(area, "readonly");
		let request = transaction.objectStore(area).get(key);
		return new Promise(function (resolve, reject) {
			request.onsuccess = function (event) {
				resolve(request.result);
			};
			request.onerror = function (event) {
				reject(request.error);	
			};
		});
	};

	get_keys(area)
	{
		let transaction = this.database.transaction(area, "readonly");
		let request = transaction.objectStore(area).getAllKeys();
		return new Promise(function (resolve, reject) {
			request.onsuccess = function (event) {
				resolve(request.result);
			};
			request.onerror = function (event) {
				reject(request.error);	
			};
		});
	};
};

const tools_database = new DataBase("TOOLS", 1, ["Star Map"]);