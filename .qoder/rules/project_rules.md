---
trigger: always_on
alwaysApply: true
---
1. 在生成代码前，先使用MCP context7工具的resolve-library-id工具获取对应技术栈的最新信息后，根据最新信息生成代码。
2. 在生成文档前，先使用MCP context7工具的resolve-library-id工具获取对应技术栈的最新信息后，结合最新信息生成文档。
3. 在调查代码前，先使用MCP context7工具的resolve-library-id工具获取对应技术栈的最新信息后，结合最新信息生成文档。
4. 请在使用MCP工具时，如果调用失败，请反复调用直到调用成功后，再继续执行
5. 请在回答问题和执行任务时，如果问题或者任务涉及到技术栈的话，先调用MCP工具获取到相关技术栈的最新版本信息后，再结合最新版本信息进行回答或执行任务