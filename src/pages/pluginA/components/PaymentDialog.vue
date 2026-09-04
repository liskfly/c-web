<script setup lang="ts">
import { ElButton, ElDialog } from 'element-plus'

const props = defineProps<{ context: Record<string, any> }>()
const { qrVisible, qrCodeUrl, qrExpired, qrCountdown, qrRefreshing, clearTimers, refreshQrCode } = props.context
</script>

<template>
<!-- QR -->
    <el-dialog v-model="qrVisible" title="扫码支付" width="360px" :close-on-click-modal="false" @close="clearTimers">
      <div style="text-align:center;position:relative">
        <img v-if="qrCodeUrl" :src="qrCodeUrl" style="width:280px;height:280px" :style="{ opacity: qrExpired ? 0.2 : 1 }" />
        <p v-if="!qrExpired" style="margin-top:12px;color:#666;font-size: 16px">请扫码支付（{{ Math.floor(qrCountdown/60) }}:{{ String(qrCountdown%60).padStart(2,'0') }}）</p>
        <div v-if="qrExpired" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,0.6)">
          <p style="color:#f53f3f;font-size: 16px;font-weight:600;margin-bottom:12px">二维码已过期</p>
          <el-button type="primary" size="small" :loading="qrRefreshing" :disabled="qrRefreshing" @click="refreshQrCode">重新加载</el-button>
        </div>
      </div>
    </el-dialog>
</template>

