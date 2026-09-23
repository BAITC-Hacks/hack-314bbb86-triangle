import certificate from './optimum-certificate.json' with {type:'json'};
import {BUDGET,HORIZON,VERSION,DISTRICTS,MEASURES,METRICS,SYNERGIES} from './data.mjs';
import {simulate} from './engine.mjs';
const fingerprint=JSON.stringify({BUDGET,HORIZON,DISTRICTS,MEASURES,METRICS,SYNERGIES});
export function globalOptimum(){
 const result=simulate(certificate.best.decisions);
 if(certificate.modelVersion!==VERSION||certificate.dataFingerprint!==fingerprint||!result.valid||Math.abs(result.score-certificate.bestScore)>1e-9)throw Error('OPTIMUM_STALE');
 return {decisions:certificate.best.decisions,result,feasibleScenarios:certificate.feasibleScenarios,algorithm:certificate.algorithm,modelVersion:certificate.modelVersion};
}
