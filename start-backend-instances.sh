#!/bin/bash

# 后端多实例启动脚本
# 使用方法：./start-backend-instances.sh

echo "🚀 启动后端多实例..."

# 创建日志目录
mkdir -p logs

# 启动实例 1
echo "📦 启动后端实例 1 (端口 3001)..."
cp .env.instance1 .env
nohup npm run start:dev > logs/backend-instance1.log 2>&1 &
INSTANCE1_PID=$!
echo "✅ 后端实例 1 已启动 (PID: $INSTANCE1_PID)"

# 等待实例 1 启动
sleep 3

# 启动实例 2
echo "📦 启动后端实例 2 (端口 3003)..."
cp .env.instance2 .env
nohup npm run start:dev > logs/backend-instance2.log 2>&1 &
INSTANCE2_PID=$!
echo "✅ 后端实例 2 已启动 (PID: $INSTANCE2_PID)"

# 等待实例 2 启动
sleep 3

# 启动实例 3
echo "📦 启动后端实例 3 (端口 3004)..."
cp .env.instance3 .env
nohup npm run start:dev > logs/backend-instance3.log 2>&1 &
INSTANCE3_PID=$!
echo "✅ 后端实例 3 已启动 (PID: $INSTANCE3_PID)"

echo ""
echo "🎉 所有后端实例已启动!"
echo "📊 实例 1: http://localhost:3001 (PID: $INSTANCE1_PID)"
echo "📊 实例 2: http://localhost:3003 (PID: $INSTANCE2_PID)"
echo "📊 实例 3: http://localhost:3004 (PID: $INSTANCE3_PID)"
echo ""
echo "📝 查看日志：tail -f logs/backend-instance1.log"
echo "🛑 停止所有实例：./stop-backend-instances.sh"

# 保存 PID 到文件
echo $INSTANCE1_PID > logs/backend-instance1.pid
echo $INSTANCE2_PID > logs/backend-instance2.pid
echo $INSTANCE3_PID > logs/backend-instance3.pid
