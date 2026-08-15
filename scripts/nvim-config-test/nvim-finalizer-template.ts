export function createNvimFinalizerLua(): string {
  return `
local report_path = assert(vim.env.NVIM_SETTINGS_TEST_REPORT, 'missing report path')
local ok, messages_result = pcall(vim.api.nvim_exec2, 'messages', { output = true })
local messages = ''
if ok and type(messages_result) == 'table' and type(messages_result.output) == 'string' then
  messages = messages_result.output
end

local data_path = vim.fn.stdpath('data')
local config_path = vim.fn.stdpath('config')
local state_path = vim.fn.stdpath('state')
local cache_path = vim.fn.stdpath('cache')
local pack_root = data_path .. '/site/pack/core/opt'
local pack_plugins = {}

local glob_ok, glob_result = pcall(vim.fn.glob, pack_root .. '/*', false, true)
if glob_ok and type(glob_result) == 'table' then
  for _, plugin_path in ipairs(glob_result) do
    if vim.fn.isdirectory(plugin_path) == 1 then
      table.insert(pack_plugins, vim.fn.fnamemodify(plugin_path, ':t'))
    end
  end
end

local payload = {
  version = vim.version().major .. '.' .. vim.version().minor .. '.' .. vim.version().patch,
  vErrmsg = vim.v.errmsg,
  messages = messages,
  runtimepath = vim.o.runtimepath,
  packpath = vim.o.packpath,
  data = data_path,
  config = config_path,
  state = state_path,
  cache = cache_path,
  packRoot = pack_root,
  packPlugins = pack_plugins,
}

local encoded = vim.json.encode(payload)
local file = assert(io.open(report_path, 'w'))
file:write(encoded)
file:close()
vim.cmd('qa!')
`.trimStart()
}
