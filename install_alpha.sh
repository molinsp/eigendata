# Check the systme type
#!/usr/bin/env bash
if conda info | grep -i 'conda version' ; then
    echo "Anaconda installed"
else
    echo "Anaconda not installed, please install Anaconda before proceeding"
fi

if conda info --envs | grep -i "\<eigendata\>"; then
    echo "There is already an enviornment named eigendata"
else
    echo "Proceed with installation"
    # 1. Determine configuration based on OS
    if [ "$(uname)" == "Darwin" ]; then
        # Do something under Mac OS X platform   
        echo "$(uname)" 
        conda env create -f default_environment.yaml    
    elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
        # Do something under GNU/Linux platform
        echo "$(uname)"
        conda env create -f default_environment.yaml
    elif [ "$(expr substr $(uname -s) 1 10)" == "MINGW32_NT" ]; then
        # Do something under 32 bits Windows NT platform
        echo "$(uname)"
        conda env create -f windows_environment.yaml  
    elif [ "$(expr substr $(uname -s) 1 10)" == "MINGW64_NT" ]; then
        # Do something under 64 bits Windows NT platform
        echo "$(uname)"
        conda env create -f windows_environment.yaml
    fi
    # 2. Source anaconda path
    conda_path=$(conda info --base)
    source "$conda_path/etc/profile.d/conda.sh"
    # 3. Activate the environment
    conda activate eigendata
    conda info | grep -i 'active environment'
    # 4. Request login to npm
    npm login
    # 5. Install jupyter lab extension
    jupyter labextension install @molinsp/eigendata
fi
