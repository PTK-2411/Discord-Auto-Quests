import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import chalk from 'chalk';
import type { PTKTool, HieuTool } from './engine';

export interface SavedAccount {
	name: string;
	token: string;
}

export interface AccountSelection {
	action: 'run' | 'save' | 'exit';
	account?: SavedAccount;
}

export type AccountVerifier = (token: string) => Promise<{ username: string; global_name: string | null }>;

interface MenuOptions {
	filePath?: string;
	banner?: string;
	notice?: string;
	verifyToken: AccountVerifier;
	createClient: (token: string) => PTKTool;
	input?: NodeJS.ReadableStream;
	output?: NodeJS.WritableStream;
}

function accountName(user: { username: string; global_name: string | null }): string {
	return user.global_name?.trim() || user.username;
}

function isSavedAccount(value: unknown): value is SavedAccount {
	if (typeof value !== 'object' || value === null) return false;
	const account = value as Partial<SavedAccount>;
	return typeof account.name === 'string' && account.name.trim().length > 0
		&& typeof account.token === 'string' && account.token.trim().length > 0;
}

async function readAccounts(filePath: string): Promise<SavedAccount[]> {
	let content: string;
	try {
		content = await readFile(filePath, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw new Error('Không thể đọc accounts.json.');
	}

	let data: unknown;
	try {
		data = JSON.parse(content);
	} catch {
		throw new Error('accounts.json không phải JSON hợp lệ.');
	}
	if (!Array.isArray(data) || !data.every(isSavedAccount)) {
		throw new Error('accounts.json phải chứa danh sách tài khoản có name và token.');
	}
	await chmod(filePath, 0o600);
	return data.map(({ name, token }) => ({ name, token }));
}

async function writeAccounts(filePath: string, accounts: SavedAccount[]): Promise<void> {
	const directory = dirname(filePath);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const temporaryPath = join(directory, `.accounts-${randomUUID()}.tmp`);
	try {
		await writeFile(temporaryPath, `${JSON.stringify(accounts, null, 2)}\n`, { mode: 0o600 });
		await chmod(temporaryPath, 0o600);
		await rename(temporaryPath, filePath);
	} catch {
		await unlink(temporaryPath).catch(() => {});
		throw new Error('Không thể ghi accounts.json.');
	}
}

function upsertAccount(accounts: SavedAccount[], account: SavedAccount): SavedAccount[] {
	return [...accounts.filter((saved) => saved.token !== account.token), account];
}

function menuNumber(value: string, maximum: number): number | null {
	if (!/^\d+$/.test(value)) return null;
	const number = Number(value);
	return number <= maximum ? number : null;
}

export async function selectAccount(options: MenuOptions): Promise<AccountSelection> {
	const filePath = options.filePath ?? join(process.cwd(), 'accounts.json');
	let accounts = await readAccounts(filePath);
	const legacyToken = process.env.TOKEN?.trim();
	if (legacyToken && !accounts.some(({ token }) => token === legacyToken)) {
		try {
			const user = await options.verifyToken(legacyToken);
			accounts = upsertAccount(accounts, { name: accountName(user), token: legacyToken });
			await writeAccounts(filePath, accounts);
			console.log(chalk.hex('#00b894')('Đã đưa token từ .env vào danh sách tài khoản.'));
		} catch {
			console.log(chalk.yellow('Không thể nhập token từ .env vào danh sách tài khoản.'));
		}
	}

	const input = options.input ?? stdin;
	const output = options.output ?? stdout;
	const isTTY = Boolean((input as NodeJS.ReadStream).isTTY);
	const rl = createInterface({ input, output, terminal: isTTY });
	const lines = rl[Symbol.asyncIterator]();
	const rlPrivate = rl as unknown as { _writeToOutput: (value: string) => void };
	let closed = false;
	rl.once('close', () => { closed = true; });
	const ask = async (prompt: string, secret = false) => {
		rl.setPrompt(chalk.hex('#74b9ff')(prompt));
		const mute = secret && isTTY;
		const originalWrite = rlPrivate._writeToOutput;
		if (!closed) rl.prompt();
		if (mute) rlPrivate._writeToOutput = () => {};
		const line = await lines.next();
		if (mute) {
			rlPrivate._writeToOutput = originalWrite;
			output.write('\n');
		}
		return line.done ? null : String(line.value).trim();
	};
	const refresh = () => {
		console.clear();
		if (options.banner) console.log(options.banner);
	};

	try {
		while (true) {
			refresh();
			if (options.notice) console.log(chalk.hex('#00b894').bold(options.notice));
			console.log(chalk.hex('#ffeaa7').bold('Chọn tài khoản'));
			console.log('1. Tài khoản đã lưu');
			console.log('2. Nhập token');
			console.log('3. Thông tin');
			console.log('0. Thoát');
			const answer = await ask('Lựa chọn: ');
			if (answer === null) return { action: 'exit' };
			const choice = menuNumber(answer, 3);
			if (choice === null) {
				console.log(chalk.red('Lựa chọn không hợp lệ.'));
				continue;
			}
			if (choice === 0) return { action: 'exit' };

			if (choice === 3) {
				while (true) {
					refresh();
					console.log(chalk.hex('#ffeaa7').bold('Thông tin'));
					console.log('GitHub: PTK-2411');
					console.log('https://github.com/PTK-2411');
					console.log('0. Quay lại');
					const answer = await ask('Lựa chọn: ');
					if (answer === null) return { action: 'exit' };
					if (menuNumber(answer, 0) === 0) break;
					console.log(chalk.red('Lựa chọn không hợp lệ.'));
				}
				continue;
			}

			if (choice === 1) {
				while (true) {
					refresh();
					console.log(chalk.hex('#ffeaa7').bold('Tài khoản đã lưu'));
					accounts.forEach((account, index) => console.log(`${index + 1}. ${account.name}`));
					console.log('0. Quay lại');
					const answer = await ask('Chọn tài khoản: ');
					if (answer === null) return { action: 'exit' };
					const selected = menuNumber(answer, accounts.length);
					if (selected === null) {
						console.log(chalk.red('Lựa chọn không hợp lệ.'));
						continue;
					}
					if (selected === 0) break;
					const account = accounts[selected - 1];
					while (true) {
						refresh();
						console.log(chalk.hex('#ffeaa7').bold(account.name));
						console.log('1. Dùng tài khoản');
						console.log('2. Xóa tài khoản');
						console.log('0. Quay lại');
						const answer = await ask('Lựa chọn: ');
						if (answer === null) return { action: 'exit' };
						const action = menuNumber(answer, 2);
						if (action === null) {
							console.log(chalk.red('Lựa chọn không hợp lệ.'));
							continue;
						}
						if (action === 0) break;
						if (action === 1) return { action: 'run', account };
						accounts = accounts.filter((saved) => saved.token !== account.token);
						await writeAccounts(filePath, accounts);
						console.log(chalk.hex('#00b894')('Đã xóa tài khoản.'));
						break;
					}
				}
				continue;
			}

			while (true) {
				refresh();
				console.log(chalk.hex('#ffeaa7').bold('Nhập token'));
				console.log('0. Quay lại');
				const token = await ask('Token: ', true);
				if (token === null || token === '0') break;
				if (!token) {
					console.log(chalk.red('Token không được để trống.'));
					continue;
				}
				console.log('Đang kiểm tra token...');
				let user: Awaited<ReturnType<AccountVerifier>>;
				try {
					user = await options.verifyToken(token);
				} catch {
					console.log(chalk.red('Không thành công. Hãy nhập lại token.'));
					continue;
				}
				const account = { name: accountName(user), token };
				while (true) {
					refresh();
					console.log(chalk.hex('#00b894')(`Lấy tài khoản thành công: ${account.name}`));
					console.log('1. Lưu và chạy');
					console.log('2. Lưu');
					console.log('3. Chạy');
					console.log('0. Hủy và quay lại menu đầu tiên');
					const answer = await ask('Lựa chọn: ');
					if (answer === null) return { action: 'exit' };
					const action = menuNumber(answer, 3);
					if (action === null) {
						console.log(chalk.red('Lựa chọn không hợp lệ.'));
						continue;
					}
					if (action === 0) break;
					if (action === 1 || action === 2) {
						accounts = upsertAccount(accounts, account);
						await writeAccounts(filePath, accounts);
						console.log(chalk.hex('#00b894')('Đã lưu tài khoản.'));
					}
					if (action === 1 || action === 3) return { action: 'run', account };
					break;
				}
				break;
			}
		}
	} finally {
		rl.close();
	}
}

export async function verifyAccountToken(createClient: MenuOptions['createClient'], token: string) {
	const client = createClient(token);
	try {
		return await client.api.users.getCurrent();
	} catch {
		throw new Error('Không thể lấy tài khoản.');
	} finally {
		await client.ws.destroy();
	}
}