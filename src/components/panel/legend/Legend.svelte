<script>
    import './Legend.css';
    import {getT} from '../../../assets/i18n/i18n.svelte.js';

    let t = $derived(getT());
</script>

<div class="cai-legend-section">
    <div class="cai-legend-body">
        <div class="cai-legend-group">
            <span class="cai-legend-group-title">{t.legend.trails}</span>
            <div class="cai-legend-entry"><span class="cai-legend-line" style="background:#ff0000"></span><span
                    class="cai-legend-label">{t.legend.t}</span></div>
            <div class="cai-legend-entry"><span class="cai-legend-line" style="background:#0070ff"></span><span
                    class="cai-legend-label">{t.legend.e}</span></div>
            <div class="cai-legend-entry"><span class="cai-legend-line" style="background:#ff8c00"></span><span
                    class="cai-legend-label">{t.legend.ee}</span></div>
            <div class="cai-legend-entry"><span class="cai-legend-line" style="background:#8b0000"></span><span
                    class="cai-legend-label">{t.legend.eea}</span></div>
        </div>
        <div class="cai-legend-group">
            <span class="cai-legend-group-title">{t.legend.shelters}</span>
            <div class="cai-legend-entry"><span class="cai-legend-circle" style="background:#2d6a4f"></span><span
                    class="cai-legend-label">{t.legend.shelter}</span></div>
        </div>
        <div class="cai-legend-group">
            <span class="cai-legend-group-title">{t.legend.peaks}</span>
            <div class="cai-legend-entry"><span class="cai-legend-triangle"
                                                style="border-bottom-color:#e76f51"></span><span
                    class="cai-legend-label">{t.legend.peak}</span></div>
        </div>
    </div>
</div>

