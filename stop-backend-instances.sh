#!/bin/bash

# 后端多实例停止脚本

echo "🛑 停止后端多实例..."

# 创建日志目录
mkdir -p logs

# 停止实例 1
if [ -f logs/backend-instance1.pid ]; then
    INSTANCE1_PID=$(cat logs/backend-instance1.pid)
    if ps -p $INSTANCE1_PID > /dev/null 2>&1; then
        kill $INSTANCE1_PID
        echo "✅ 后端实例 1 已停止 (PID: $INSTANCE1_PID)"
    else
        echo "⚠️  后端实例 1 未运行"
    fi
    rm logs/backend-instance1.pid
fi

# 停止实例 2
if [ -f logs/backend-instance2.pid ]; then
    INSTANCE2_PID=$(cat logs/backend-instance2.pid)
    if ps -p $INSTANCE2_PID > /dev/null 2>&1; then
        kill $INSTANCE2_PID
        echo "✅ 后端实例 2 已停止 (PID: $INSTANCE2_PID)"
    else
        echo "⚠️  后端实例 2 未运行"
    fi
    rm logs/backend-instance2.pid
fi

# 停止实例 3
if [ -f logs/backend-instance3.pid ]; then
    INSTANCE3_PID=$(cat logs/backend-instance3.pid)
    if ps -p $INSTANCE3_PID > /dev/null 2>&1; then
        kill $INSTANCE3_PID
        echo "✅ 后端实例 3 已停止 (PID: $INSTANCE3_PID)"
    else
        echo "⚠️  后端实例 3 未运行"
    fi
    rm logs/backend-instance3.pid
fi

# 也尝试通过端口杀进程（备用方案）
echo "🔍 清理残留进程..."
lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "✅ 清理端口 3001"
lsof -ti:3003 | xargs kill -9 2>/dev/null && echo "✅ 清理端口 3003"
lsof -ti:3004 | xargs kill -9 2>/dev/null && echo "✅ 清理端口 3004"

echo "🎉 所有后端实例已停止!"
