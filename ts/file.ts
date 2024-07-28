export class UnexpectedFlowError extends Error
{
	static readonly name: "UnexpectedFlowError" = "UnexpectedFlowError";
}
export class AsyncObject
{
	protected actions: {[name: string]: Promise<any> | undefined};
	constructor()
	{
		this.actions = {};
	}
	public async wait_action(name: string): Promise<void>
	{
		if (this.actions[name])
		{
			await this.actions[name];
			this.actions[name] = undefined;
		}
	}
}
export function read_file(file: Blob): Promise<string | ArrayBuffer | null>
{
	const reader = new FileReader();
	reader.readAsDataURL(file);
	return new Promise(function (resolve, reject) {
		reader.onload = function () {
			resolve(reader.result);
		};
		reader.onerror = function () {
			reject(reader.error);
		};
	});
}
export class DataBase extends AsyncObject
{
	protected database?: IDBDatabase;
	protected upgradeneeded: boolean;
	constructor(namespace: string, version?: number, areas: string[] = [])
	{
		super();
		this.upgradeneeded = false;
		this.actions = {
			open: undefined
		};
		this.database = undefined;
		const database = indexedDB.open(namespace, version);
		const WrapperObject = this;
		this.actions.open = new Promise(function (resolve, reject){
			database.onsuccess = function () {
				WrapperObject.database = database.result;
				resolve(database.result);
			};
			database.onupgradeneeded = function () {
				WrapperObject.upgradeneeded = true;
				WrapperObject.database = database.result;
				for (const each_area of areas)
				{
					WrapperObject.database.createObjectStore(each_area, {keyPath: "key"});
				}
				resolve(database.result);
			};
			database.onerror = function () {
				reject(database.error);
			};
		});
	}
	public async write_to_data(area: string, key: string, content: any): Promise<void>
	{
		if (this.database === undefined)
		{
			await this.actions.open;
		}
		if (this.database === undefined) // This should never happen.
		{
			throw new UnexpectedFlowError();
		}
		const transaction = this.database.transaction(area, "readwrite");
		transaction.objectStore(area).put({key: key, content: content});
	}
	public async delete_data(area: string, key: string): Promise<void>
	{
		if (this.database === undefined)
		{
			await this.actions.open;
		}
		if (this.database === undefined) // This should never happen.
		{
			throw new UnexpectedFlowError();
		}
		const transaction = this.database.transaction(area, "readwrite");
		transaction.objectStore(area).delete(key);
	}
	public async get_data(area: string, key: string): Promise<any>
	{
		if (this.database === undefined)
		{
			await this.actions.open;
		}
		if (this.database === undefined) // This should never happen.
		{
			throw new UnexpectedFlowError();
		}
		const transaction = this.database.transaction(area, "readonly");
		const request = transaction.objectStore(area).get(key);
		return new Promise(function (resolve, reject) {
			request.onsuccess = () => {
				resolve(request.result);
			};
			request.onerror = () => {
				reject(request.error);	
			};
		});
	}
	public async get_keys(area: string): Promise<IDBValidKey[]>
	{
		if (this.database === undefined)
		{
			await this.actions.open;
		}
		if (this.database === undefined) // This should never happen.
		{
			throw new UnexpectedFlowError();
		}
		const transaction = this.database.transaction(area, "readonly");
		const request = transaction.objectStore(area).getAllKeys();
		return new Promise(function (resolve, reject) {
			request.onsuccess = () => {
				resolve(request.result);
			};
			request.onerror = () => {
				reject(request.error);	
			};
		});
	}
}

export const tools_database = new DataBase("tools", 1, ["Star Map"]);