<script setup lang="ts">
import { reactive, ref } from 'vue'
import { BLOCK_LABELS, describe, newBlock } from '@/pipeline'
import type { Block, BlockType, Pipeline, StepResult } from '@/pipeline'
import { useEngineStore } from '@/stores/engine'
import CollapsibleBox from './CollapsibleBox.vue'
import CopyJsonButton from './CopyJsonButton.vue'
import GridAddCell from './GridAddCell.vue'
import InlineEdit from './InlineEdit.vue'
import PipelineBlock from './PipelineBlock.vue'

const store = useEngineStore()

const error = ref('')
/** The pipeline just created, so its legend opens straight into editing. */
const newPipeline = ref('')

/** Pipelines folded down to their title bar, by name. Session-only. */
const closed = reactive<Record<string, boolean>>({})

function onToggle(p: Pipeline, e: Event) {
  closed[p.name] = !(e.target as HTMLDetailsElement).open
}

/** The title bar's summary of the result: its size, or why there isn't one. */
function headTag(p: Pipeline): { text: string; cls: string } {
  if (p.off) return { text: 'Off', cls: '' }
  const r = final(p)
  return r?.ok ? { text: describe(r.value), cls: 'is-success' } : { text: 'No result', cls: 'is-danger' }
}

const ADDABLE: Exclude<BlockType, 'source'>[] = ['filter', 'map', 'test', 'count']

function results(p: Pipeline): StepResult[] {
  return store.pipelineResults[p.name] ?? []
}

/** What block i receives: the output of the block before it. */
function inputOf(p: Pipeline, i: number): unknown {
  const prev = results(p)[i - 1]
  return prev?.ok ? prev.value : undefined
}

/** What pipeline p's conditions can read: the result of the one directly above. */
function readable(pi: number): string[] {
  const prev = store.pipelines[pi - 1]
  return prev ? [prev.name] : []
}

function final(p: Pipeline): StepResult | undefined {
  return results(p)[p.blocks.length - 1]
}

/** The result, shown whole when it's short ([1, 3], true, 12), else summarised. */
function finalText(p: Pipeline): string {
  const r = final(p)
  if (!r?.ok) return ''
  const json = JSON.stringify(r.value)
  return json.length <= 40 ? json : describe(r.value)
}

function setBlocks(p: Pipeline, blocks: Block[]) {
  store.setPipelineBlocks(p.name, blocks)
}

function addBlock(p: Pipeline, e: Event) {
  const select = e.target as HTMLSelectElement
  if (select.value) setBlocks(p, [...p.blocks, newBlock(select.value as Exclude<BlockType, 'source'>)])
  select.value = ''
}

function moveBlock(p: Pipeline, i: number, step: -1 | 1) {
  const blocks = [...p.blocks]
  ;[blocks[i], blocks[i + step]] = [blocks[i + step], blocks[i]]
  setBlocks(p, blocks)
}

function addPipeline() {
  error.value = ''
  newPipeline.value = store.addPipeline()
}

function removePipeline(p: Pipeline) {
  if (p.blocks.length > 1 && !confirm(`Delete the "${p.name}" pipeline?`)) return
  store.removePipeline(p.name)
}
</script>

<template>
  <CollapsibleBox section="pipelines" title="Filter Pipeline">
    <div class="mt-3">
      <p class="help block">
        A pipeline is a stack of blocks: each takes the output of the one above, and the last
        one's output is the pipeline's result. Start from a source - a list source comes through
        its Source Filter - then filter, map, test or count. Inside a block, conditions read each
        item's own fields as well as the sources and form values, and can check a list on the
        item with <strong>Check a list</strong>. A pipeline can also read the result of the
        pipeline directly above it (as <strong>Pipeline result</strong>, e.g. <em>id is one of
        Buyers</em>), so the pipelines build towards one answer, shown under Results. They stay in
        the order they're added, as each one is built on the one above. Untick a pipeline to leave
        it out of the result while you test (the first is always on), and click its title bar to
        fold it away.
        <strong>Copy JSON</strong> gives the whole pipeline as one JSON Logic expression, with the
        Source Filters and the pipeline above written in - to run it, your app needs the sources
        and form values in scope, including inside <code>filter</code>, <code>map</code> and
        <code>some</code>.
      </p>

      <p v-if="error" class="help is-danger mb-3">{{ error }}</p>

      <div class="fixed-grid has-1-cols">
        <div class="grid">
          <!-- In the title bar, the name renames and the checkbox and delete work as they do
               anywhere; clicking the rest of the bar folds the pipeline away or opens it. -->
          <details v-for="(p, pi) in store.pipelines" :key="p.name" class="cell pipeline-card"
            :class="{ 'is-off': p.off }" :open="!closed[p.name]" @toggle="onToggle(p, $event)">
            <summary class="pipeline-card-head">
              <svg class="move-icon pipeline-card-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              <input type="checkbox" :checked="pi === 0 || !p.off" :disabled="pi === 0"
                :aria-label="`${p.name}: use in the result`"
                :title="pi === 0 ? 'The first pipeline is always on: the others are built on it' : 'Use this pipeline in the result'"
                @change="store.setPipelineOn(p.name, ($event.target as HTMLInputElement).checked)" />
              <strong class="pipeline-card-name">
                <InlineEdit :text="p.name" :auto-edit="p.name === newPipeline"
                  @save="(t) => (error = store.renamePipeline(p.name, t))" />
              </strong>
              <span class="tag" :class="headTag(p).cls">{{ headTag(p).text }}</span>
              <button type="button" class="delete pipeline-card-delete" title="Delete pipeline"
                :aria-label="`Delete ${p.name}`" @click="removePipeline(p)"></button>
            </summary>

            <div class="pipeline-stack mt-2">
              <!-- The source first, then its steps indented beneath it on a guide line. -->
              <template v-for="b in p.blocks.slice(0, 1)" :key="0">
                <PipelineBlock :block="b" :input="undefined" :result="results(p)[0]" :pipelines="readable(pi)"
                  :label="`${p.name} source`" :can-move-up="false" :can-move-down="false"
                  @update="(nb) => setBlocks(p, [nb, ...p.blocks.slice(1)])" />
              </template>

              <div class="pipeline-steps">
                <template v-for="(b, i) in p.blocks" :key="i">
                  <template v-if="i > 0">
                    <div class="pipeline-arrow" aria-hidden="true">
                      <svg class="move-icon" viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
                    </div>
                    <PipelineBlock :block="b" :input="inputOf(p, i)" :result="results(p)[i]" :pipelines="readable(pi)"
                      :label="`${p.name} ${BLOCK_LABELS[b.type].toLowerCase()} ${i + 1}`"
                      :can-move-up="i > 1" :can-move-down="i < p.blocks.length - 1"
                      @update="(nb) => setBlocks(p, p.blocks.map((x, j) => (j === i ? nb : x)))"
                      @remove="setBlocks(p, p.blocks.filter((_, j) => j !== i))"
                      @move="(step) => moveBlock(p, i, step)" />
                  </template>
                </template>

                <div class="pipeline-arrow" aria-hidden="true">
                  <svg class="move-icon" viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
                </div>
                <div class="field">
                  <div class="control">
                    <div class="select is-fullwidth">
                      <select :aria-label="`${p.name}: add a block`" @change="addBlock(p, $event)">
                        <option value="">Add a block…</option>
                        <option v-for="t in ADDABLE" :key="t" :value="t">{{ BLOCK_LABELS[t] }}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <p class="pipeline-result">
                <strong>Result:</strong>
                <span v-if="final(p)?.ok" class="tag is-success ml-2">{{ finalText(p) }}</span>
                <span v-else class="tag is-danger ml-2">None yet</span>
              </p>
            </div>

            <div class="pipeline-card-actions">
              <CopyJsonButton :value="() => store.compiledPipeline(p)" title="Copy the pipeline as one JSON Logic expression" />
            </div>
          </details>
          <GridAddCell label="Add pipeline" @add="addPipeline" />
        </div>
      </div>
    </div>
  </CollapsibleBox>
</template>
