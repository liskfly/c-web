<script setup lang="ts">
const props = defineProps<{ context: Record<string, any> }>()
const { quoteData, submitting, ordering, tokenReady, orderCompleted, formatMoney, submitForm, submitOrder } = props.context
</script>

<template>
<!-- 报价 -->
      <div class="quote-card">
        <div class="qc-title">💰 报价摘要</div>
        <div class="qc-grid">
          <div class="qc-row"><span>制板费</span><span class="qcv">¥{{ formatMoney(quoteData?.boardBaseFee) }}</span></div>
          <div class="qc-row"><span>工程费</span><span class="qcv">¥{{ formatMoney(quoteData?.engineeringFee) }}</span></div>
          <div class="qc-row"><span>特殊工艺加价</span><span class="qcv">¥{{ formatMoney(quoteData?.specialProcessFee) }}</span></div>
          <div class="qc-row"><span>加急费</span><span class="qcv">¥{{ quoteData?.expediteFee || '--' }}</span></div>
          <div class="qc-row"><span>单价</span><span class="qcv">{{ quoteData ? '¥' + formatMoney(quoteData.price) + ' / PCS' : '--' }}</span></div>
        </div>
        <div class="qc-total"><span>预估总价<br><small>(不含税运)</small></span><span class="qc-price">{{ quoteData ? '¥' + formatMoney(quoteData.totalFee) : '--' }}</span></div>
        <button class="btn-submit" :disabled="submitting || !tokenReady" @click="submitForm">{{ submitting ? '提交中...' : '获取报价' }}</button>
        <button class="btn-submit btn-order" :disabled="ordering || !quoteData || !tokenReady || orderCompleted" @click="submitOrder">{{ orderCompleted ? '已提交' : ordering ? '提交中...' : '提交订单' }}</button>
        <p class="qc-note">价格仅供参考，以审核为准</p>
      </div>
</template>

