# 1. Install required packages
conda env create -f environment.yaml
# 2. Source anaconda path
conda_path=$(conda info --base)
source "$conda_path/etc/profile.d/conda.sh"
# 3. Activate the environment
conda activate test
conda info | grep -i 'active environment'
# 4. Request login to npm
npm login
# 5. Install jupyter lab extension
jupyter labextension install @molinsp/eigendata