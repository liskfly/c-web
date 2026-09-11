<script setup lang="ts">
const props = defineProps<{ context: Record<string, any> }>()
const {
  oldQuoteData, quoteData, submitting, ordering, tokenReady, orderCompleted, notifyLoading, deeplineMode,
  formatMoney, submitForm, submitOrder, submitNotify,
} = props.context
</script>

<template>
      <!-- 线上旧报价 -->
      <div v-if="oldQuoteData" class="quote-card old-quote-card">
        <div class="qc-title">📋 线上报价</div>
        <template v-if="oldQuoteData.items && oldQuoteData.items.length">
          <div class="qc-grid" v-for="(item, idx) in oldQuoteData.items" :key="idx">
            <div class="qc-row"><span>制板费</span><span class="qcv">¥{{ formatMoney(item.ai_analysis_price_data?.board_base_fee) }}</span></div>
            <div class="qc-row"><span>工程费</span><span class="qcv">¥{{ formatMoney(item.ai_analysis_price_data?.engineering_fee) }}</span></div>
            <div class="qc-row"><span>特殊工艺加价</span><span class="qcv">¥{{ formatMoney(item.ai_analysis_price_data?.special_process_fee) }}</span></div>
            <div class="qc-row"><span>加急费</span><span class="qcv">¥{{ formatMoney(item.ai_analysis_price_data?.expedite_fee) }}</span></div>
            <div class="qc-row"><span>交期</span><span class="qcv">{{ item.ai_analysis_price_data?.delivery_days || '--' }} 天</span></div>
            <div class="qc-row"><span>单价</span><span class="qcv">¥{{ formatMoney(item.ai_analysis_price_data?.price) }}</span></div>
          </div>
        </template>
        <div class="qc-divider"></div>
        <div class="qc-row"><span>运费</span><span class="qcv">¥{{ formatMoney(oldQuoteData.items?.[0]?.ai_analysis_price_data?.freight_price) }}</span></div>
        <div class="qc-total"><span>总价</span><span class="qc-price">¥{{ formatMoney(oldQuoteData.total_price) }}</span></div>
      </div>

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
        <button class="btn-submit btn-order" :disabled="ordering || !quoteData || !tokenReady || orderCompleted" @click="submitOrder">{{ orderCompleted ? '已提交' : ordering ? '提交中...' : '提交审核' }}</button>
        <button v-if="!deeplineMode" class="btn-submit" :disabled="!orderCompleted || notifyLoading" @click="submitNotify" style="background:linear-gradient(90deg,#00b42a,#00a057)">{{ notifyLoading ? '确认中...' : '审核确认' }}</button>
        <p class="qc-note">价格仅供参考，以审核为准</p>
      </div>
</template>
